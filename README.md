[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=yeskiy_sitemapper&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=yeskiy_sitemapper)
[![Test](https://github.com/yeskiy/sitemapper/actions/workflows/test.yml/badge.svg?branch=master&event=push)](https://github.com/yeskiy/sitemapper/actions/workflows/test.yml)
[![NPM Version](https://img.shields.io/npm/v/%40yeskiy%2Fsitemapper)](https://www.npmjs.com/package/@yeskiy/sitemapper/access)
[![NPM Downloads](https://img.shields.io/npm/dm/%40yeskiy%2Fsitemapper%2Faccess)](https://www.npmjs.com/package/@yeskiy/sitemapper/access)
[![license](https://img.shields.io/github/license/yeskiy/sitemapper.svg)](https://github.com/yeskiy/sitemapper/blob/main/LICENSE)
# Sitemap-parser
## NOTE: This is a fork of the original sitemapper package with full migration to `ESM` and `ts`. The original package can be found [here](https://www.npmjs.com/package/sitemapper)

Parse through a sitemaps xml to get all the urls for your crawler.

### Installation
```bash
npm install @yeskiy/sitemapper --save
```

### Simple Example
```typescript
import Sitemapper from '@yeskiy/sitemapper';

const sitemap = new Sitemapper();

sitemap.fetch('https://www.google.com/work/sitemap.xml').then((sites) => {
    console.log(sites);
});

```

# Options

You can add options on the initial Sitemapper object when instantiating it.

+ `requestHeaders`: (Object) - Additional Request Headers (e.g. `User-Agent`)
+ `timeout`: (Number) - Maximum timeout in ms for a single URL. Default: 15000 (15 seconds)
+ `url`: (String) - Sitemap URL to crawl
+ `debug`: (Boolean) - Enables/Disables debug console logging. Default: False
+ `concurrency`: (Number) - Sets the maximum number of concurrent sitemap crawling threads. Default: 10
+ `retries`: (Number) - Sets the maximum number of retries to attempt in case of an error response (e.g. 404 or Timeout). Default: 0
+ `rejectUnauthorized`: (Boolean) - If true, it will throw on invalid certificates, such as expired or self-signed ones. Default: True
+ `lastmod`: (Number) - Timestamp of the minimum lastmod value allowed for returned urls
+ `gotParams`: (GotOptions) - Additional options to pass to the `got` library. See **[Got Options](https://github.com/sindresorhus/got/blob/main/documentation/2-options.md)**


## License
[MIT](https://choosealicense.com/licenses/mit/)