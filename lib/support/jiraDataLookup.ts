/*
 * Copyright © 2019 Atomist, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
    configurationValue,
    HandlerContext,
    HttpClientFactory,
    HttpMethod,
    logger,
} from "@atomist/automation-client";
import { SdmContext } from "@atomist/sdm";
import {
    getJiraAuth,
    JiraConfig,
} from "../jira";
import { JiraCache } from "./cache/jiraCache";

/**
 * This function retrieves details from JIRA.  You must supply the full "self"
 * url to the endpoint to retrieve the data from.  Using the generic you can retrieve many
 * types of data with this function.
 *
 *  example: const result = await jiraSelfUrl<User>("http://localhost:8080/rest/api/2/user?username=matt");
 *
 * @param {string} jiraSelfUrl Supply the api endpoint to the given user
 * @param {boolean} cache Can we store the result of this query? Default false
 * @param {number} ttl If we cache, how long should we store this? Default 3600
 * @param {HandlerContext} ctx Passed to supply detail to getJiraAuth.  Where present in calling functions, should be passed in.
 * @returns {T}
 */
export async function getJiraDetails<T>(jiraSelfUrl: string, cache: boolean = false, ttl: number = 3600, ctx?: SdmContext): Promise<T> {
    const useCache = configurationValue<boolean>("sdm.jira.useCache", false) && cache;
    const httpClient = configurationValue<HttpClientFactory>("http.client.factory").create(jiraSelfUrl);
    const jiraCache = configurationValue<JiraCache>("sdm.jiraCache");
    const cacheResult = jiraCache.get<T>(jiraSelfUrl);

    if (useCache && cacheResult !== undefined) {
        logger.debug(`JIRA getJiraDetails => ${jiraSelfUrl}: Cache hit, re-using value...`);
        return cacheResult;
    } else {
        logger.debug(`JIRA getJiraDetails => ${jiraSelfUrl}: Cache ${useCache ? "miss" : "disabled"}, querying...`);
        try {
            const result = await httpClient.exchange<T>(
                jiraSelfUrl,
                {
                    method: HttpMethod.Get,
                    headers: {
                        Accept: "application/json",
                        ...await getJiraAuth(ctx),
                    },
                },
            );

            if (cache) {
                jiraCache.set(jiraSelfUrl, result.body, ttl);
            }
            return result.body;
        } catch (e) {
            const error = `JIRA getJiraDetails: Failed to retrieve details for ${jiraSelfUrl}, error thrown: ${e}`;
            logger.error(error);
            throw new Error(e);
        }
    }
}

interface JiraRepoDetailLink {
    name: string;
    url: string;
}
interface JiraRepoDetail {
    repositories: JiraRepoDetailLink[];
}

interface JiraIssueRepo {
    detail: JiraRepoDetail[];
}

/**
 * Return the list of repos associated with this JIRA issue (ie a commit is linked to this Issue).
 * Note: This is dependant on the VCS type in use which needs to be supplied in your configuration
 * see docs for details
 *
 * @param {issueId} issueId The ID of the JIRA issue.
 * @returns {string[]} List of repo names
 */
export async function getJiraIssueRepos(issueId: string): Promise<string[]> {
    const jiraConfig = configurationValue<object>("sdm.jira") as JiraConfig;
    const lookupUrl =
        // tslint:disable-next-line:max-line-length
        `${jiraConfig.url}/rest/dev-status/latest/issue/detail?issueId=${issueId}&applicationType=${jiraConfig.vcstype}&dataType=repository`;

    logger.debug(`JIRA getJiraIssueRepos: using issueID => ${issueId}`);
    logger.debug(`JIRA getJiraIssueRepos: using lookupUrl => ${JSON.stringify(lookupUrl)}`);
    const httpClient = configurationValue<HttpClientFactory>("http.client.factory").create(lookupUrl);
    const result = await httpClient.exchange(
        lookupUrl,
        {
            method: HttpMethod.Get,
            headers: {
                Accept: "application/json",
                ...await getJiraAuth(),
            },
        },
    );
        // .then(result => {
    const repos: string[] = [];
    const data = result.body as JiraIssueRepo;
    logger.debug(`JIRA getJiraIssueRepos: ticket detail => ${JSON.stringify(data.detail)}`);

    if (data.detail && data.detail.length > 0) {
        data.detail.forEach(d => {
            d.repositories.forEach(r => {
                repos.push(r.name);
            });
        });

        logger.debug(`JIRA getJiraIssueRepos: Found repos => ${JSON.stringify(repos)}`);
        return repos;
    } else {
        logger.warn(`JIRA getJiraIssueRepos: no repos found! IssueId => ${issueId}`);
        return [];
    }
}
