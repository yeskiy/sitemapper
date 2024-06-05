/**
 * Sitemap Parser
 *
 * Copyright (c) 2020 Sean Thomas Burke
 * Licensed under the MIT license.
 * @author Sean Burke <@seantomburke>
 * @maintain Yehor Brodskiy <@yeskiy>
 */

import { parseStringPromise } from "xml2js";
import got, { GotOptions, GotPromise } from "got";
import pLimit from "p-limit";
import zlib from "node:zlib";
import isGzip from "is-gzip";

class Sitemapper<T extends string | null = null> {
    public url: string;

    public timeout: number;

    private timeoutTable: Record<string, NodeJS.Timeout>;

    public lastmod: number;

    private requestHeaders: Record<string, string>;

    public debug: boolean;

    private concurrency: number;

    private retries: number;

    public rejectUnauthorized: boolean;

    private fields: boolean;

    private gotParams: GotOptions<T>;

    /**
     * The Sitemapper class constructor.
     *
     * @param {Object} options to set
     * @param {string} [options.url] - the Sitemap url (e.g https://www.google.com/work/sitemap.xml)
     * @param {number} [options.timeout] - Timeout in milliseconds for each request. Default is 15000
     * @param {number} [options.lastmod] - The minimum lastmod value for urls
     * @param {Record<string, string>} [options.requestHeaders] - Headers to include in requests
     * @param {boolean} [options.debug] - Enables/Disables additional logging
     * @param {number} [options.concurrency] - The number of concurrent sitemaps to crawl (e.g., 10 will crawl no more than 10 sitemaps at the same time)
     * @param {number} [options.retries] - The maximum number of retries to attempt when crawling fails (e.g., 0 for no retries)
     * @param {boolean} [options.rejectUnauthorized] - If true (default), it will throw on invalid certificates, such as expired or self-signed ones.
     * @param {GotOptions} [options.gotParams] - additional parameters to pass to the got request
     * @example
     * const sitemap = new Sitemapper({
     *   url: 'https://www.google.com/work/sitemap.xml',
     *   timeout: 15000,
     *   lastmod: 1630693759
     *  });
     */
    constructor(options: Sitemapper.ConstructorOptions = {}) {
        this.url = options.url;
        this.timeout = options.timeout || 15000;
        this.timeoutTable = {};
        this.lastmod = options.lastmod || 0;
        this.requestHeaders = options.requestHeaders || {};
        this.debug = options.debug;
        this.concurrency = options.concurrency || 10;
        this.retries = options.retries || 0;
        this.rejectUnauthorized = options.rejectUnauthorized !== false;
        this.fields = options.fields || false;
        this.gotParams = options.gotParams || {};
    }

    /**
     * Gets the sites from a sitemap.xml with a given URL
     *
     * @public
     * @param {string} [url] - the Sitemaps url (e.g https://www.google.com/work/sitemap.xml)
     * @returns {Promise<Sitemapper.SitesData>}
     * @example
     * sitemapper.fetch('example.xml')
     *  .then((sites) => console.log(sites));
     */
    async fetch(url: string = this.url): Promise<Sitemapper.SitesData> {
        if (this.debug) {
            if (this.lastmod) {
                console.debug(`Using minimum lastmod value of ${this.lastmod}`);
            }
        }

        try {
            const results = await this.crawl(url);
            return {
                url,
                sites: results.sites || [],
                errors: results.errors || [],
            };
        } catch (e) {
            if (this.debug) {
                console.error(e);
            }
            return {
                url,
                sites: [],
                errors: [
                    {
                        type: "InternalError",
                        url,
                        retries: 0,
                        message: e.toString(),
                    },
                ],
            };
        }
    }

    private async crawl(
        url: string,
        retryIndex: number = 0,
    ): Promise<Sitemapper.CrawlResult> {
        try {
            const { error, data } = await this.parse(url);
            this.clearTimeout(url);

            if (error) {
                if (retryIndex < this.retries) {
                    if (this.debug) {
                        console.log(
                            `(Retry attempt: ${retryIndex + 1} / ${
                                this.retries
                            }) ${url} due to ${data.name} on previous request`,
                        );
                    }
                    return await this.crawl(url, retryIndex + 1);
                }

                if (this.debug) {
                    console.error(
                        `Error occurred during "crawl('${url}')":\n\r Error: ${error}`,
                    );
                }
                return Sitemapper.prepareInternalErrorResponse(
                    url,
                    retryIndex,
                    (() => {
                        const a = new Error(error);
                        a.name = data.name;
                        return a;
                    })(),
                );
            }
            if (data && data.urlset && data.urlset.url) {
                if (this.debug) {
                    console.debug(`Urlset found during "crawl('${url}')"`);
                }

                const sites = (
                    !this.lastmod
                        ? data.urlset.url
                        : data.urlset.url.filter(
                              (site) =>
                                  site.lastmod &&
                                  new Date(site.lastmod[0]).getTime() >=
                                      this.lastmod,
                          )
                ).map((site) => {
                    if (!this.fields) {
                        return site.loc && site.loc[0];
                    }

                    return Object.entries(this.fields).reduce(
                        (acc, [field, active]) => ({
                            ...acc,
                            ...(active && { [field]: site[field][0] }),
                        }),
                        {},
                    );
                }) as string[];

                return {
                    sites,
                    errors: [],
                };
            }
            if (data && data.sitemapindex) {
                if (this.debug) {
                    console.debug(
                        `Additional sitemap found during "crawl('${url}')"`,
                    );
                }

                const sitemap = data.sitemapindex.sitemap.map(
                    (map) => map.loc && map.loc[0],
                );

                const limit = pLimit(this.concurrency);
                const promiseArray = sitemap.map((site) =>
                    limit(() => this.crawl(site)),
                );

                const results = await Promise.all(promiseArray);
                const sites = results
                    .filter((result) => result.errors.length === 0)
                    .reduce(
                        (prev, { sites: subSites }) => [...prev, ...subSites],
                        [],
                    );
                const errors = results
                    .filter((result) => result.errors.length !== 0)
                    .reduce(
                        (prev, { errors: subErrors }) => [
                            ...prev,
                            ...subErrors,
                        ],
                        [],
                    );

                return {
                    sites,
                    errors,
                };
            }

            if (retryIndex < this.retries) {
                if (this.debug) {
                    console.log(
                        `(Retry attempt: ${retryIndex + 1} / ${
                            this.retries
                        }) ${url} due to ${data.name} on previous request`,
                    );
                }
                return await this.crawl(url, retryIndex + 1);
            }

            if (this.debug) {
                console.error(
                    `Unknown state during "crawl('${url})'":`,
                    error,
                    data,
                );
            }
            return Sitemapper.prepareInternalErrorResponse(
                url,
                retryIndex,
                new Error("An unknown error occurred."),
            );
        } catch (e) {
            if (this.debug) {
                console.error(e);
            }
            return Sitemapper.prepareInternalErrorResponse(url, retryIndex, e);
        }
    }

    private static prepareInternalErrorResponse(
        url: string,
        retires: number,
        error: Error,
    ): Sitemapper.CrawlResult {
        return {
            sites: [],
            errors: [
                {
                    url,
                    type: error.name || "InternalError",
                    message: `${error.message} ${error.stack}`,
                    retries: retires,
                },
            ],
        };
    }

    private static async prepareTextResponse(buffer: Buffer): Promise<string> {
        if (isGzip(buffer)) {
            return new Promise((resolve, reject) => {
                zlib.gunzip(buffer, (err, result) => {
                    if (err) {
                        reject(err);
                    }
                    resolve(result.toString());
                });
            });
        }
        return buffer.toString();
    }

    private async parse(url: string): Promise<Sitemapper.ParseResult> {
        const requestOptions: GotOptions<any> = {
            method: "GET",
            decompress: true,
            headers: this.requestHeaders,
            ...this.gotParams,
        };

        try {
            const requester = got(url, requestOptions);

            this.initializeTimeout(url, requester);

            const response = await requester;

            if (!response || response.statusCode !== 200) {
                this.clearTimeout(url);
                return {
                    error: `${response.errored.name} ${response.errored.message} ${response.errored.stack}`,
                    data: null,
                };
            }

            const data = await parseStringPromise(
                (await Sitemapper.prepareTextResponse(
                    // @ts-ignore
                    response.rawBody as Buffer,
                )) || "",
            );
            return { error: null, data };
        } catch (error) {
            console.log(error);
            this.clearTimeout(url);
            // If the request was canceled notify the user of the timeout
            if (error.name === "CancelError") {
                return {
                    error: `Request timed out after ${this.timeout} milliseconds for url: '${url}'`,
                    data: error,
                };
            }

            // If an HTTPError include error http code
            if (error.name === "HTTPError") {
                return {
                    error: `HTTP Error occurred: ${error.message}`,
                    data: error,
                };
            }

            // Otherwise notify of another error
            return {
                error: `Error occurred: ${error.toString()}`,
                data: error,
            };
        }
    }

    private initializeTimeout<
        E extends string | object | Buffer = string | object | Buffer,
    >(url: string, requester: GotPromise<E>) {
        this.timeoutTable[url] = setTimeout(
            () => requester.cancel(),
            this.timeout,
        );
    }

    private clearTimeout(url: string) {
        if (this.timeoutTable[url]) {
            clearTimeout(this.timeoutTable[url]);
            Reflect.deleteProperty(this.timeoutTable, url);
        }
    }
}
namespace Sitemapper {
    export interface ConstructorOptions<T extends string | null = null> {
        url?: string;
        timeout?: number;
        lastmod?: number;
        requestHeaders?: Record<string, string>;
        debug?: boolean;
        concurrency?: number;
        retries?: number;
        rejectUnauthorized?: boolean;
        proxyAgent?: any;
        fields?: boolean;
        gotParams?: GotOptions<T>;
    }

    export interface SitemapperErrorData {
        type: string;
        url: string;
        retries: number;
        message?: string;
    }

    export interface SitesData extends CrawlResult {
        url: string;
    }

    export interface CrawlResult {
        sites: string[];
        errors: SitemapperErrorData[];
    }

    export interface ParseResult {
        error: string | null;
        data: {
            urlset?: {
                url: ({
                    loc: string[];
                    lastmod?: string[];
                } & Record<string, any>)[];
            };
            sitemapindex?: {
                sitemap: {
                    loc: string[];
                }[];
            };
            name?: string;
        };
    }
}

export default Sitemapper;
