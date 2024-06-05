import isUrl from "is-url";
import { describe, beforeEach, it, expect } from "vitest";
import Sitemapper from "../src";

describe("Sitemapper", () => {
    let sitemapper: Sitemapper;

    beforeEach(() => {
        sitemapper = new Sitemapper();
    });

    describe("Sitemapper Class", () => {
        it("should have fetch method", () => {
            expect(typeof sitemapper.fetch).toBe("function");
        });

        it("should construct with a url", () => {
            sitemapper = new Sitemapper({ url: "google.com" });
            expect(sitemapper.url).toBe("google.com");
        });

        it("should construct with a timeout", () => {
            sitemapper = new Sitemapper({ timeout: 1000 });
            expect(sitemapper.timeout).toBe(1000);
        });

        it("should set timeout", () => {
            sitemapper.timeout = 1000;
            expect(sitemapper.timeout).toBe(1000);
        });

        it("should set url", () => {
            sitemapper.url = "google.com";
            expect(sitemapper.url).toBe("google.com");
        });

        describe("fetch Method resolves sites to array", () => {
            const url1 = "https://wp.seantburke.com/sitemap.xml";
            const url2 = "http://gibberish.gibberish";
            const url3 = "https://www.google.com/work/sitemap.xml";
            const url4 = "https://www.golinks.io/sitemap.xml";
            const url5 = "https://foo.com/sitemap.xml";

            it(`${url1} sitemaps should be an array`, async () => {
                const data = await sitemapper.fetch(url1);
                expect(data.sites).toBeInstanceOf(Array);
                expect(data.url).toBe(url1);
                expect(data.sites.length).toBeGreaterThan(2);
                expect(isUrl(String(data.sites[0]))).toBe(true);
            });

            it(`${url2} should fail silently with an empty array`, async () => {
                const data = await sitemapper.fetch(url2);
                expect(data.sites).toBeInstanceOf(Array);
                expect(data.errors).toBeInstanceOf(Array);
            });

            it(`${url3} sitemaps should be an array`, async () => {
                const data = await sitemapper.fetch(url3);
                expect(data.sites).toBeInstanceOf(Array);
                expect(data.url).toBe(url3);
                expect(data.sites.length).toBeGreaterThan(2);
                expect(isUrl(String(data.sites[0]))).toBe(true);
            });

            it(`${url4} sitemaps should be an array`, async () => {
                const data = await sitemapper.fetch(url4);
                expect(data.sites).toBeInstanceOf(Array);
                expect(data.url).toBe(url4);
                expect(data.sites.length).toBeGreaterThan(2);
                expect(isUrl(String(data.sites[0]))).toBe(true);
            });

            it(`${url4} sitemaps should return an empty array when timing out`, async () => {
                sitemapper.timeout = 1;
                const data = await sitemapper.fetch(url4);
                expect(data.sites).toBeInstanceOf(Array);
            });

            it(`${url5} should allow insecure request`, async () => {
                sitemapper.timeout = 10000;
                sitemapper.rejectUnauthorized = true;
                const data = await sitemapper.fetch(url5);
                expect(Array.isArray(data.sites)).toBeTruthy();
                expect(Array.isArray(data.errors)).toBeTruthy();
            });

            it(`${url5} should not allow insecure request`, async () => {
                sitemapper.timeout = 10000;
                sitemapper.rejectUnauthorized = false;
                const data = await sitemapper.fetch(url5);
                expect(Array.isArray(data.sites)).toBeTruthy();
                expect(Array.isArray(data.errors)).toBeTruthy();
            });
        });

        describe("gzipped sitemaps", () => {
            beforeEach(() => {
                sitemapper = new Sitemapper({
                    requestHeaders: {
                        "Accept-Encoding": "gzip,deflate,sdch",
                    },
                });
            });

            const url = "https://www.banggood.com/sitemap/category.xml.gz";

            it(`${url} gzip should be a non-empty array`, async () => {
                sitemapper.timeout = 10000;
                const data = await sitemapper.fetch(url);
                expect(data.sites).toBeInstanceOf(Array);
                expect(data.errors).toBeInstanceOf(Array);
                expect(data.sites.length).toBeGreaterThan(0);
            });
        });
    });
});
