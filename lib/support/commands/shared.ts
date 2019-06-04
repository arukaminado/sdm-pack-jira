import {
    addressEvent,
    configurationValue,
    HandlerContext,
    HttpClientFactory,
    HttpMethod,
    logger,
    MappedParameter,
    MappedParameters,
    Parameters,
} from "@atomist/automation-client";
import { Option } from "@atomist/automation-client/lib/metadata/automationMetadata";
import {
    CommandListenerInvocation,
    PreferenceStoreFactory,
    SdmContext,
} from "@atomist/sdm";
import * as objectHash from "object-hash";
import {
    getJiraAuth,
    JiraConfig,
} from "../../jira";
import { JiraPreference } from "../cache/lookup";
import { purgeCacheEntry } from "../cache/manage";
import { getJiraDetails } from "../jiraDataLookup";
import {
    Issue,
    Project,
} from "../jiraDefs";

@Parameters()
export class JiraHandlerParam {
    @MappedParameter(MappedParameters.SlackChannelName)
    public slackChannelName: string;

    @MappedParameter(MappedParameters.SlackChannel)
    public slackChannel: string;
}

export interface JiraMapping {
    projectId: string;
    channel: string;
    componentId?: string;
}

export interface JiraItemCreated {
    id: string;
    key: string;
    self: string;
}

export function buildJiraHashKey(workspaceId: string, payload: JiraMapping): string {
    const hash = `${workspaceId}` +
        `${"-" + payload.componentId || ""}` +
        `${"-" + payload.projectId || ""}`   +
        `${"-" + payload.channel || ""}`     +
        `-${objectHash(payload)}`;
    logger.debug(`JIRA buildJiraHashKey: generated hashkey [${hash}] for payload ${JSON.stringify(payload)}`);
    return hash;
}

export function submitMappingPayload(
    ci: CommandListenerInvocation<JiraHandlerParam>,
    payload: JiraMapping,
    active: boolean = true,
): Promise<void> {
    return new Promise<void>(async (resolve, reject) => {
        try {
            const prefStore = configurationValue<PreferenceStoreFactory>("sdm.preferenceStoreFactory")(ci.context);
            if (active) {
                await prefStore.put<JiraMapping>(
                    buildJiraHashKey(ci.context.workspaceId, payload),
                    payload,
                    {scope: "JIRAMappings"},
                );
            } else {
                await prefStore.delete(
                    buildJiraHashKey(ci.context.workspaceId, payload),
                    {scope: "JIRAMappings"},
                );
            }
            // Purge cache entry for this payload as well as for channel lookups (which just use the channel in the payload)
            await purgeCacheEntry(buildJiraHashKey(ci.context.workspaceId, payload));
            await purgeCacheEntry(buildJiraHashKey(ci.context.workspaceId, {channel: payload.channel, projectId: undefined, componentId: undefined}));
            resolve();
        } catch (e) {
            logger.error(`JIRA submitMappingPayload: Error found => ${e}`);
            reject(e);
        }
    });
}

export const createJiraTicket = async (data: any, ctx?: SdmContext): Promise<JiraItemCreated> => {
    const jiraConfig = configurationValue<object>("sdm.jira") as JiraConfig;
    return createJiraResource(`${jiraConfig.url}/rest/api/2/issue`, data, undefined, ctx);
};

export interface JiraProjectDefinition {
    key: string;
    name: string;
    lead: string;
    description: string;
    projectTypeKey: string;
    projectTemplateKey: string;
    assigneeType: string;
    extraData?: any;
}

export async function createJiraProject(
    data: JiraProjectDefinition,
    ctx?: SdmContext,
): Promise<JiraItemCreated> {
    const jiraConfig = configurationValue<object>("sdm.jira") as JiraConfig;
    return createJiraResource(`${jiraConfig.url}/rest/api/2/project`, {
        key: data.key,
        name: data.name,
        lead: data.lead,
        description: data.description,
        projectTypeKey: data.projectTypeKey,
        projectTemplateKey: data.projectTemplateKey,
        assigneeType: data.assigneeType,
        ...data.extraData,
    }, undefined, ctx);
}

export interface JiraComponentDefinition {
    name: string;
    description: string;
    project: string;
    assigneeType: "PROJECT_LEAD" | "COMPONENT_LEAD" | "UNASSIGNED" | "PROJECT_DEFAULT";
    extraData?: any;
}

export async function createJiraComponent(
    data: JiraComponentDefinition,
    ctx?: SdmContext,
): Promise<JiraItemCreated> {
    const jiraConfig = configurationValue<object>("sdm.jira") as JiraConfig;
    return createJiraResource(`${jiraConfig.url}/rest/api/2/component`, {
        name: data.name,
        description: data.description,
        project: data.project,
        assigneeType: data.assigneeType,
        ...data.extraData,
    }, undefined, ctx);
}

export const createJiraResource = async (apiUrl: string, data: any, update: boolean = false, ctx?: SdmContext): Promise<JiraItemCreated> => {
    const httpClient = configurationValue<HttpClientFactory>("http.client.factory").create(apiUrl);
    logger.warn(`JIRA createJiraResource: Data payload => ${JSON.stringify(data)}`);

    const result = await httpClient.exchange(
        apiUrl,
        {
            method: update ? HttpMethod.Put : HttpMethod.Post,
            headers: {
                "Content-Type": "application/json",
                ...await getJiraAuth(ctx),
            },
            body: data,
        },
    ).catch(e => {
        logger.error(
            "JIRA createJiraResource: Failed to create resource with error - " +
            `(${JSON.stringify(e.response.status)}) ${JSON.stringify(e.response.data)}`,
        );
        throw new Error(JSON.stringify(e.response.data));
    });

    return result.body as JiraItemCreated;
};

export async function prepProjectSelect(search: string, ctx: SdmContext): Promise<Option[] | undefined> {
    const jiraConfig = configurationValue<object>("sdm.jira") as JiraConfig;

    // Get Search pattern for project lookup
    const lookupUrl = `${jiraConfig.url}/rest/api/2/project`;

    // Find projects that match project search string
    const projectValues: Option[] = [];
    const result = await getJiraDetails<Project[]>(lookupUrl, true, undefined, ctx);

    result.forEach(p => {
        if (p.name.toLowerCase().includes(search.toLowerCase())) {
            logger.debug(`JIRA prepProjectSelect: Found project match ${p.name}!`);
            projectValues.push({description: p.name, value: p.id});
        }
    });

    if (projectValues.length > 0) {
        return projectValues;
    } else {
        return undefined;
    }
}

export async function prepComponentSelect(
    project: string,
    ctx: SdmContext,
): Promise<Option[] | undefined> {
    const jiraConfig = configurationValue<object>("sdm.jira") as JiraConfig;
    const componentLookupUrl = `${jiraConfig.url}/rest/api/2/project/${project}`;
    const projectDetails = await getJiraDetails<Project>(componentLookupUrl, false, undefined, ctx);
    const componentValues: Option[] = [];

    projectDetails.components.forEach(c => {
        componentValues.push({description: c.name, value: c.id});
    });

    if (componentValues.length > 0) {
        return componentValues;
    } else {
        return undefined;
    }
}

export interface JiraQueryLanguageIssueResults {
    issues: Issue[];
    startAt: number;
    maxResults: number;
    total: number;
}

/**
 * Simple helper to retrieve issues via JQL query
 *
 * Notice - Pagination is NOT handled here, needs to be handled in the calling function.  There are helper startAt/maxResults parameters so you do not
 * have to include these items in your query string
 *
 * @param {String} jql: JQL syntax only
 * @param {String} startAt?: The index to start retrieving from (for pagination)
 * @param {String} maxResults?: The max number of issues to retrieve
 * @param {SdmContext} ctx?: SdmContext to pass for authentication purposes.  Should be used when calling this function from a command handler.
 * @returns {JiraQueryLanguageIssueResults}
 */
export async function searchIssues(
    jql: string,
    startAt?: string,
    maxResults?: string,
    ctx?: SdmContext,
): Promise<JiraQueryLanguageIssueResults> {
    const jiraConfig = configurationValue<object>("sdm.jira") as JiraConfig;
    let issueLookup = `${jiraConfig.url}/rest/api/2/search?jql=${jql}`;
    if (startAt) {
        issueLookup = issueLookup + `&startAt=${startAt}`;
    }
    if (maxResults) {
        issueLookup = issueLookup + `&maxResults=${maxResults}`;
    }
    return getJiraDetails<JiraQueryLanguageIssueResults>(issueLookup, false, undefined, ctx);
}
