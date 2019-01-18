import { GitHubRepoRef, GraphQL, logger, OnEvent, Success } from "@atomist/automation-client";
import { EventHandlerRegistration, findSdmGoalOnCommit, Goal, SdmGoalState, updateGoal } from "@atomist/sdm";
import { getJiraDetails } from "../support/jiraDataLookup";
import { Issue } from "../support/jiraDefs";
import { routeEvent } from "../support/routeEvent";
import * as types from "../typings/types";

function onJiraIssueEventHandler():
    OnEvent<types.OnJiraIssueEvent.Subscription> {
    return async (e, ctx) => {
        logger.info(`JIRA Event recieved, ${JSON.stringify(e.data.JiraIssue, undefined, 2)}`);
        await routeEvent(ctx, e.data.JiraIssue[0]);
        return Success;
    };
}

export const onJiraIssueEvent = ():
   EventHandlerRegistration<types.OnJiraIssueEvent.Subscription> => {
   return {
       name: "OnJiraIssueEvent",
       subscription: GraphQL.subscription("OnJiraIssueEvent"),
       listener: onJiraIssueEventHandler(),
   };
};

export const onJiraIssueEventApprovalHandler = (goal: Goal): OnEvent<types.OnJiraIssueEvent.Subscription> => {
    return async (e, ctx) => {
        const event =  e.data.JiraIssue[0];
        const issue = await getJiraDetails<Issue>(e.data.JiraIssue[0].issue.self);

        // Search environment for tags
        const sha = /\[atomist:sha:(.*)\]/gm.exec(issue.fields.description)[1];
        const owner = /\[atomist:owner:(.*)\]/gm.exec(issue.fields.description)[1];
        const repo = /\[atomist:repo:(.*)\]/gm.exec(issue.fields.description)[1];
        const branch = /\[atomist:branch:(.*)\]/gm.exec(issue.fields.description)[1];

        if (!sha || !owner || !repo || !branch) {
            logger.info(`JIRA onJiraIssueEventApprovalHandler: No enviornment data found on issue, skipping event...`);
            return Success;
        }

        // Validate new state is approved (only process if this issue is a state change)
        if (
            event.webhookEvent !== "jira:issue_updated" ||
            !event.issue_event_type_name.match(/^(issue_generic|issue_updated|issue_assigned)$/) ||
            event.changelog === null
        ) {
           logger.info(`JIRA onJiraIssueEventApprovalHandler: Not searching for approval, wrong event type.`);
           return Success;
        }

        // Get new status
        const status = event.changelog.items.filter(c => c.field === "status");
        logger.info(`JIRA onJiraIssueEventApprovalHandler: New status => ${JSON.stringify(status)}`);
        if (status[0].toString === "Approved") {
            const repoRef = GitHubRepoRef.from({
                owner,
                repo,
                sha,
                branch,
            });

            const sdmGoalData =
                await ctx.graphClient.query<types.GetGoalByJiraIssueId.Query, types.GetGoalByJiraIssueId.Variables>({
                    name: "GetGoalByJiraIssueId",
                    variables: { issueId: e.data.JiraIssue[0].issue.id },
                });

            if (!(sdmGoalData.SdmGoal.length > 0)) {
                logger.info(`JIRA onJiraIssueEventApprovalHandler: No matching goal found for this issue, skipping...`);
                return Success;
            }

            const sdmGoal = await findSdmGoalOnCommit(
                ctx,
                repoRef,
                sdmGoalData.SdmGoal[0].repo.providerId,
                goal,
            );

            // Set goal state to succesful
            await updateGoal(ctx, sdmGoal, {
                state: SdmGoalState.success,
                description: goal.successDescription,
            });

            // Update JIRA ticket?

            return Success;
        } else {
            return Success;
        }
    };
};

export const onJiraIssueEventApproval = (goal: Goal):
   EventHandlerRegistration<types.OnJiraIssueEvent.Subscription> => {
   return {
       name: "OnJiraIssueEventApproval",
       subscription: GraphQL.subscription("OnJiraIssueEvent"),
       listener: onJiraIssueEventApprovalHandler(goal),
   };
};
