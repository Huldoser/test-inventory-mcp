# MCP tool reference

Generated from the server's tool schemas and real calls. Regenerate with `npm run docs:tools`; `npm run docs:check` checks drift.

These examples scan a disposable copy of the made-up trading app. A login test is marked skip between the saved before and after scans. No project code is executed.

The request examples show the tool name and arguments, without a JSON-RPC envelope. Responses show the complete structuredContent object; the server also returns the same JSON as text. Paths are relative to the configured project.

- [test_summary](#test_summary)
- [find_tests](#find_tests)
- [get_tests](#get_tests)
- [scan_diagnostics](#scan_diagnostics)
- [diff_inventories](#diff_inventories)

## Shared behavior

- The four scan tools reread files on each call. diff_inventories reads saved scans instead.
- Input objects reject unknown keys. Keep the other arguments unchanged when passing nextCursor back as cursor.
- A null nextCursor ends pagination. get_tests uses remaining ids instead of a cursor when a response is full.
- directory and related paths are relative to the configured server root. patterns and diagnostic path are relative to directory; narrowing directory does not change the base of related.
- For conditional counts, use test_summary with the same filters and read summary.conditionalCount. When counting records, request isConditional explicitly and retrieve every page.
- No matches is a successful empty result. scanErrors counts errors that may leave tests out; call scan_diagnostics before trusting completeness.
- A declared conditional state is not a run result. Expected failures execute. Related tests are candidates, not proof that other tests are safe to omit.

## test_summary

Available since MCP 0.1.0. Arguments added later have their own compatibility requirements; see [versioning](../README.md#versioning).

Counts a project's tests by state (active, skip, fixme, todo, expectedToFail, notLoaded) and by tag and annotation, from the test files, without running them. Use it first, for questions such as how many tests are skipped, or which files or tags have the most skipped tests; use find_tests to list the tests themselves. states, tags and grep count only the tests they match. groupBy "file", "tag" or "project" adds the counts of each, sorted by name and paged with limit and cursor; a test with no tag is in no tag group, and one whose projects the scan cannot tell in no project group. configs lists the config files read and their projects. Example: {"states": ["skip", "fixme"], "groupBy": "file"}.

### Arguments

| Field         | Type     | Required | Description                                                                                                                                                                                                                                                                                                               |
| ------------- | -------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `directory`   | string   | No       | A folder inside the project to scan, relative to its root, such as "packages/web". Default: the root. Minimum length: 1.                                                                                                                                                                                                  |
| `framework`   | string   | No       | The test runner. Default: the one the server was started with, otherwise the one the project in `directory` uses. Values: `playwright`, `vitest`, `jest`, `mocha`, `jasmine`, `cypress`, `webdriverio`, `node`, `bun`.                                                                                                    |
| `patterns`    | string[] | No       | Globs of the test files, relative to `directory`, such as ["tests/**/*.spec.ts"]. Default: the ones the server was started with, or without them the files the configs in `directory` and below it run. Minimum items: 1. Each item: Minimum length: 1.                                                                   |
| `expandCases` | boolean  | No       | Lists each case of a .each or .for table and each pass of a loop as its own test, with the name the runner gives it and caseIndex, as the runner registers them. Ids differ from those without it, so pass the same value to get_tests. Default: false, one test per declaration with caseCount.                          |
| `states`      | string[] | No       | Keeps tests in one of these states. Minimum items: 1. Each item: Values: `active`, `skip`, `fixme`, `todo`, `expectedToFail`, `notLoaded`.                                                                                                                                                                                |
| `tags`        | string[] | No       | Keeps tests with one of these tags, written as in the titles, such as "@smoke". Minimum items: 1. Each item: Minimum length: 1.                                                                                                                                                                                           |
| `grep`        | string   | No       | Keeps tests whose fullName (describe titles and title joined with " &gt; ") matches this regular expression, ignoring case. Minimum length: 1.                                                                                                                                                                            |
| `related`     | string[] | No       | Changed files, relative to the project root as `git diff --name-only` writes them, such as ["pages/order-ticket.ts"]. Keeps the tests a change to one of them can affect: those whose dependencies include it, and those that reach code the scan can't follow (hasUnfollowedDependencies). Each item: Minimum length: 1. |
| `groupBy`     | string   | No       | Adds the counts of each file, tag or project. Values: `file`, `tag`, `project`.                                                                                                                                                                                                                                           |
| `limit`       | integer  | No       | The most items to return. Default: `50`. Minimum: 1. Maximum: 200.                                                                                                                                                                                                                                                        |
| `cursor`      | string   | No       | nextCursor from the previous answer, for the next page. Keep the other arguments the same. Minimum length: 1.                                                                                                                                                                                                             |

### Response fields

| Field              | Type             | Required | Description                                                                               |
| ------------------ | ---------------- | -------- | ----------------------------------------------------------------------------------------- |
| `framework`        | Framework        | Yes      |                                                                                           |
| `frameworkVersion` | string or null   | Yes      |                                                                                           |
| `summary`          | Summary          | Yes      | Counts over the matching tests; fileCount is every file scanned.                          |
| `configs`          | ConfigRecord[]   | Yes      | The config files the scanned test files use, with their projects; [] when none was found. |
| `groups`           | object[] or null | Yes      | One page of groups; null without groupBy.                                                 |
| `total`            | integer or null  | Yes      | All groups, on every page; null without groupBy.                                          |
| `nextCursor`       | string or null   | Yes      | Pass it as `cursor` for the next page; null on the last.                                  |
| `scanErrors`       | integer          | Yes      | Problems of level error in the scan, which may leave tests out of the answer.             |
| `hint`             | string or null   | Yes      | What to do next, when there is something to say.                                          |

Nested test records use the [core output format](https://huldoser.github.io/test-inventory/reference/output).

### Complete example

```json
{
  "name": "test_summary",
  "arguments": {
    "states": ["skip", "fixme"],
    "groupBy": "file",
    "limit": 2
  }
}
```

Response:

```json
{
  "framework": "playwright",
  "frameworkVersion": "1.63.0",
  "summary": {
    "fileCount": 11,
    "suiteCount": 5,
    "testCount": 8,
    "activeCount": 0,
    "skipCount": 4,
    "fixmeCount": 4,
    "todoCount": 0,
    "expectedToFailCount": 0,
    "notLoadedCount": 0,
    "onlyCount": 0,
    "conditionalCount": 6,
    "parallelCount": 0,
    "serialCount": 0,
    "parameterizedCount": 0,
    "inLoopCount": 0,
    "inConditionCount": 0,
    "inFunctionCount": 0,
    "typeTestCount": 0,
    "benchmarkCount": 0,
    "diagnosticCount": 0,
    "tagCounts": {
      "@orders": 1,
      "@smoke": 2
    },
    "annotationCounts": {
      "issue": 1
    }
  },
  "configs": [
    {
      "relativeFilePath": "playwright.config.ts",
      "extends": [],
      "projects": [
        {
          "name": "chromium",
          "testDir": "tests",
          "dependencies": []
        },
        {
          "name": "webkit",
          "testDir": "tests",
          "dependencies": []
        },
        {
          "name": "mobile-smoke",
          "testDir": "tests",
          "dependencies": []
        }
      ]
    }
  ],
  "groups": [
    {
      "key": "tests/alerts.spec.ts",
      "testCount": 3,
      "activeCount": 0,
      "skipCount": 3,
      "fixmeCount": 0,
      "todoCount": 0,
      "expectedToFailCount": 0,
      "notLoadedCount": 0
    },
    {
      "key": "tests/login.spec.ts",
      "testCount": 2,
      "activeCount": 0,
      "skipCount": 1,
      "fixmeCount": 1,
      "todoCount": 0,
      "expectedToFailCount": 0,
      "notLoadedCount": 0
    }
  ],
  "total": 4,
  "nextCursor": "eyJvZmZzZXQiOjIsImRpZ2VzdCI6IjUzZTdkYWM0ZTkxZjk2OGQifQ",
  "scanErrors": 0,
  "hint": "Showing 2 of 4. Pass nextCursor as `cursor` for more, or narrow the filters."
}
```

## find_tests

Available since MCP 0.1.0. Arguments added later have their own compatibility requirements; see [versioning](../README.md#versioning).

Lists a project's tests that match filters, read from the test files without running them: each with its id, full name, file and line, state, skip reason and condition, and tags by default. Use it for questions such as which tests are skipped and why, which tests carry @smoke, where a .only was left in, or which tests a change can affect (related, the changed files); use test_summary for counts and get_tests for every key of a few ids. projects keeps the tests one of the named projects runs, after each project's grep, leaving out tests whose projects the scan cannot tell. Filters combine with AND; a list matches any of its values. fields picks other keys of the test records (id is always there). Answers are paged: follow nextCursor, or narrow the filters. Example: {"states": ["skip"], "withoutReason": true}.

### Arguments

| Field           | Type     | Required | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| --------------- | -------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `directory`     | string   | No       | A folder inside the project to scan, relative to its root, such as "packages/web". Default: the root. Minimum length: 1.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `framework`     | string   | No       | The test runner. Default: the one the server was started with, otherwise the one the project in `directory` uses. Values: `playwright`, `vitest`, `jest`, `mocha`, `jasmine`, `cypress`, `webdriverio`, `node`, `bun`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `patterns`      | string[] | No       | Globs of the test files, relative to `directory`, such as ["tests/**/*.spec.ts"]. Default: the ones the server was started with, or without them the files the configs in `directory` and below it run. Minimum items: 1. Each item: Minimum length: 1.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `expandCases`   | boolean  | No       | Lists each case of a .each or .for table and each pass of a loop as its own test, with the name the runner gives it and caseIndex, as the runner registers them. Ids differ from those without it, so pass the same value to get_tests. Default: false, one test per declaration with caseCount.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `states`        | string[] | No       | Keeps tests in one of these states. Minimum items: 1. Each item: Values: `active`, `skip`, `fixme`, `todo`, `expectedToFail`, `notLoaded`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `tags`          | string[] | No       | Keeps tests with one of these tags, written as in the titles, such as "@smoke". Minimum items: 1. Each item: Minimum length: 1.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `grep`          | string   | No       | Keeps tests whose fullName (describe titles and title joined with " &gt; ") matches this regular expression, ignoring case. Minimum length: 1.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `related`       | string[] | No       | Changed files, relative to the project root as `git diff --name-only` writes them, such as ["pages/order-ticket.ts"]. Keeps the tests a change to one of them can affect: those whose dependencies include it, and those that reach code the scan can't follow (hasUnfollowedDependencies). Each item: Minimum length: 1.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `projects`      | string[] | No       | Keeps tests that one of these projects runs, named as in the configs test_summary lists. Minimum items: 1.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `only`          | boolean  | No       | true keeps tests that use .only, or are in a describe that does.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `withoutReason` | boolean  | No       | true keeps non-active tests without a reason, including expected failures; excludes notLoaded.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `fields`        | string[] | No       | Keys of each test record to return, besides id. Default: fullName, relativeFilePath, lineStart, state, reason, condition, tags. Minimum items: 1. Each item: Values: `id`, `bodyHash`, `dependencyHash`, `dependencies`, `hasUnfollowedDependencies`, `suiteId`, `parentTestId`, `suitePath`, `relativeFilePath`, `fileName`, `lineStart`, `lineEnd`, `columnStart`, `columnEnd`, `declaredAt`, `title`, `titleWithoutTags`, `hasDynamicTitle`, `fullName`, `isTypeTest`, `state`, `isActive`, `isSkipped`, `isFixme`, `isTodo`, `isExpectedToFail`, `isNotLoaded`, `isOnly`, `isConditional`, `condition`, `reason`, `hasDynamicReason`, `stateSource`, `stateLine`, `isParallel`, `isSerial`, `tags`, `annotations`, `comments`, `locks`, `meta`, `hooks`, `timeout`, `isSlow`, `slowCondition`, `retries`, `retryDelay`, `retryCondition`, `repeats`, `timeoutSource`, `retriesSource`, `repeatsSource`, `timeoutConfigText`, `retriesConfigText`, `repeatsConfigText`, `fixtures`, `expectCount`, `expectedAssertions`, `expectsAssertions`, `hasEmptyBody`, `steps`, `isBenchmark`, `isParameterized`, `caseCount`, `caseIndex`, `isInLoop`, `isInCondition`, `isInFunction`, `projects`. |
| `limit`         | integer  | No       | The most items to return. Default: `50`. Minimum: 1. Maximum: 200.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `cursor`        | string   | No       | nextCursor from the previous answer, for the next page. Keep the other arguments the same. Minimum length: 1.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

### Response fields

| Field              | Type           | Required | Description                                                                   |
| ------------------ | -------------- | -------- | ----------------------------------------------------------------------------- |
| `framework`        | Framework      | Yes      |                                                                               |
| `frameworkVersion` | string or null | Yes      |                                                                               |
| `total`            | integer        | Yes      | All matching items, on every page.                                            |
| `nextCursor`       | string or null | Yes      | Pass it as `cursor` for the next page; null on the last.                      |
| `tests`            | object[]       | Yes      | One page of matching tests, in file and line order.                           |
| `scanErrors`       | integer        | Yes      | Problems of level error in the scan, which may leave tests out of the answer. |
| `hint`             | string or null | Yes      | What to do next, when there is something to say.                              |

Nested test records use the [core output format](https://huldoser.github.io/test-inventory/reference/output).

### Complete example

```json
{
  "name": "find_tests",
  "arguments": {
    "states": ["skip", "fixme"],
    "fields": ["fullName", "state", "condition", "reason"],
    "limit": 2
  }
}
```

Response:

```json
{
  "framework": "playwright",
  "frameworkVersion": "1.63.0",
  "total": 8,
  "tests": [
    {
      "id": "006bcf2289191aef",
      "fullName": "price alerts > notifies when the price crosses above the alert",
      "state": "skip",
      "condition": "isMarketClosed()",
      "reason": "Alerts only trigger while the market is open"
    },
    {
      "id": "4ef5fcb2d36793f3",
      "fullName": "price alerts > does not notify for a price that was never reached",
      "state": "skip",
      "condition": "isMarketClosed()",
      "reason": "Alerts only trigger while the market is open"
    }
  ],
  "nextCursor": "eyJvZmZzZXQiOjIsImRpZ2VzdCI6IjNjYTYyYmMyZjhjNGY4ZmIifQ",
  "scanErrors": 0,
  "hint": "Showing 2 of 8. Pass nextCursor as `cursor` for more, or narrow the filters."
}
```

## get_tests

Available since MCP 0.1.0. Arguments added later have their own compatibility requirements; see [versioning](../README.md#versioning).

Returns every key of the tests with the given ids, with the scan diagnostics about them, read from the test files without running them: location, describe path, state and where it is set, condition, reason, tags, annotations, comments above the test, parameters, the projects that run it, hooks around it, timeout and retries with where each is set (the test, a describe, the file or the config), fixtures, expect() counts, steps, body hash, and the files the test runs with dependencyHash. Use it after find_tests or test_summary, for the details of up to 20 tests. Ids come from find_tests and stay the same when a test moves to another line, but change when its title, describe or file changes; ids not in the current scan are returned in notFound. Example: {"ids": ["3f9a0c1d2e4b5a69"]}. An answer that would be too long returns the first tests and the other ids in remaining.

### Arguments

| Field         | Type     | Required | Description                                                                                                                                                                                                                                                                                      |
| ------------- | -------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `directory`   | string   | No       | A folder inside the project to scan, relative to its root, such as "packages/web". Default: the root. Minimum length: 1.                                                                                                                                                                         |
| `framework`   | string   | No       | The test runner. Default: the one the server was started with, otherwise the one the project in `directory` uses. Values: `playwright`, `vitest`, `jest`, `mocha`, `jasmine`, `cypress`, `webdriverio`, `node`, `bun`.                                                                           |
| `patterns`    | string[] | No       | Globs of the test files, relative to `directory`, such as ["tests/**/*.spec.ts"]. Default: the ones the server was started with, or without them the files the configs in `directory` and below it run. Minimum items: 1. Each item: Minimum length: 1.                                          |
| `expandCases` | boolean  | No       | Lists each case of a .each or .for table and each pass of a loop as its own test, with the name the runner gives it and caseIndex, as the runner registers them. Ids differ from those without it, so pass the same value to get_tests. Default: false, one test per declaration with caseCount. |
| `ids`         | string[] | Yes      | Test ids, as find_tests returns them. Minimum items: 1. Maximum items: 20. Each item: Minimum length: 1.                                                                                                                                                                                         |

### Response fields

| Field              | Type           | Required | Description                                                                   |
| ------------------ | -------------- | -------- | ----------------------------------------------------------------------------- |
| `framework`        | Framework      | Yes      |                                                                               |
| `frameworkVersion` | string or null | Yes      |                                                                               |
| `tests`            | TestRecord[]   | Yes      | The tests found, in the order of ids.                                         |
| `diagnostics`      | Diagnostic[]   | Yes      | Problems the scan reports about these tests.                                  |
| `notFound`         | string[]       | Yes      | Ids that are not in this scan.                                                |
| `remaining`        | string[]       | Yes      | Ids found but left out to keep the answer short; pass them again.             |
| `scanErrors`       | integer        | Yes      | Problems of level error in the scan, which may leave tests out of the answer. |
| `hint`             | string or null | Yes      | What to do next, when there is something to say.                              |

Nested test records use the [core output format](https://huldoser.github.io/test-inventory/reference/output).

### Complete example

```json
{
  "name": "get_tests",
  "arguments": {
    "ids": ["dbb8916ae393be67"]
  }
}
```

Response:

```json
{
  "framework": "playwright",
  "frameworkVersion": "1.63.0",
  "tests": [
    {
      "id": "dbb8916ae393be67",
      "bodyHash": "3bd267efc7ff4ded",
      "dependencyHash": "869e75d97d6f8682",
      "dependencies": [
        "fixtures/index.ts",
        "pages/login-page.ts",
        "playwright.config.ts",
        "test-data/accounts.ts",
        "tests/login.spec.ts"
      ],
      "hasUnfollowedDependencies": false,
      "suiteId": "d9caec00cd2537da",
      "parentTestId": null,
      "suitePath": ["login"],
      "relativeFilePath": "tests/login.spec.ts",
      "fileName": "login.spec.ts",
      "lineStart": 25,
      "lineEnd": 29,
      "columnStart": 3,
      "columnEnd": 5,
      "declaredAt": null,
      "title": "asks for a one-time code on a new device",
      "titleWithoutTags": "asks for a one-time code on a new device",
      "hasDynamicTitle": false,
      "fullName": "login > asks for a one-time code on a new device",
      "isTypeTest": false,
      "state": "fixme",
      "isActive": false,
      "isSkipped": false,
      "isFixme": true,
      "isTodo": false,
      "isExpectedToFail": false,
      "isNotLoaded": false,
      "isOnly": false,
      "isConditional": false,
      "condition": null,
      "reason": null,
      "hasDynamicReason": false,
      "stateSource": "test",
      "stateLine": 25,
      "isParallel": false,
      "isSerial": false,
      "tags": ["@smoke"],
      "annotations": [],
      "comments": ["FIXME: TRD-301 the one-time code screen is behind a feature flag on staging"],
      "locks": [],
      "meta": null,
      "hooks": {
        "beforeAll": 0,
        "beforeEach": 1,
        "afterEach": 0,
        "afterAll": 0,
        "aroundEach": 0,
        "aroundAll": 0
      },
      "timeout": null,
      "isSlow": false,
      "slowCondition": null,
      "retries": null,
      "retryDelay": null,
      "retryCondition": null,
      "repeats": null,
      "timeoutSource": null,
      "retriesSource": "config",
      "repeatsSource": null,
      "timeoutConfigText": null,
      "retriesConfigText": "process.env.CI ? 2 : 0",
      "repeatsConfigText": null,
      "fixtures": ["loginPage", "context"],
      "expectCount": 1,
      "expectedAssertions": null,
      "expectsAssertions": false,
      "hasEmptyBody": false,
      "steps": [],
      "isBenchmark": false,
      "isParameterized": false,
      "caseCount": null,
      "caseIndex": null,
      "isInLoop": false,
      "isInCondition": false,
      "isInFunction": false,
      "projects": ["chromium", "webkit", "mobile-smoke"]
    }
  ],
  "diagnostics": [],
  "notFound": [],
  "remaining": [],
  "scanErrors": 0,
  "hint": null
}
```

## scan_diagnostics

Available since MCP 0.1.0. Arguments added later have their own compatibility requirements; see [versioning](../README.md#versioning).

Lists the problems test-inventory found while reading the test files: level error means tests may be missing from the other answers (a file that failed to parse, an import it could not follow), or that the runner fails the file or the run (a Vitest tag the config does not define, a .only that forbidOnly fails); level warning means a value is missing or approximate (a title built at run time, a config value computed at run time, a file no config runs). They are about reading the code, not test failures. Use it when another tool reports scanErrors, or to check why a test is missing or notLoaded. Answers are paged: follow nextCursor. Example: {"levels": ["error"]}.

### Arguments

| Field         | Type     | Required | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------- | -------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `directory`   | string   | No       | A folder inside the project to scan, relative to its root, such as "packages/web". Default: the root. Minimum length: 1.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `framework`   | string   | No       | The test runner. Default: the one the server was started with, otherwise the one the project in `directory` uses. Values: `playwright`, `vitest`, `jest`, `mocha`, `jasmine`, `cypress`, `webdriverio`, `node`, `bun`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `patterns`    | string[] | No       | Globs of the test files, relative to `directory`, such as ["tests/**/*.spec.ts"]. Default: the ones the server was started with, or without them the files the configs in `directory` and below it run. Minimum items: 1. Each item: Minimum length: 1.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `expandCases` | boolean  | No       | Lists each case of a .each or .for table and each pass of a loop as its own test, with the name the runner gives it and caseIndex, as the runner registers them. Ids differ from those without it, so pass the same value to get_tests. Default: false, one test per declaration with caseCount.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `levels`      | string[] | No       | Keeps problems of these levels. Minimum items: 1. Each item: Values: `error`, `warning`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `codes`       | string[] | No       | Keeps problems with these codes. Minimum items: 1. Each item: Values: `unresolved-test-import`, `parse-error`, `read-error`, `framework-mismatch`, `unresolved-tag`, `unresolved-annotation`, `unresolved-cases`, `cases-not-expanded`, `test-in-loop`, `dynamic-title`, `duplicate-title`, `duplicate-id`, `internal-error`, `invalid-chain`, `skip-without-body`, `test-without-body`, `describe-not-called`, `async-describe`, `describe-throws`, `nested-test`, `tag-without-at`, `removed-api`, `invalid-fixture-argument`, `only-in-skipped-describe`, `config-may-change-state`, `undefined-tag`, `symlink-ignored`, `invalid-import`, `globals-not-enabled`, `unknown-framework-version`, `unsupported-framework-version`, `local-test-object`, `state-in-helper`, `unresolved-option`, `dynamic-reason`, `no-files-matched`, `unsupported-file`, `approximate-framework-version`, `test-in-function`, `empty-title`, `bench-outside-benchmark-file`, `config-value-unknown`, `file-not-run`, `forbidden-only`, `dependency-not-followed`. |
| `path`        | string   | No       | Keeps problems in this file, or in the files under this folder, relative to `directory`. Minimum length: 1.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `limit`       | integer  | No       | The most items to return. Default: `50`. Minimum: 1. Maximum: 200.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `cursor`      | string   | No       | nextCursor from the previous answer, for the next page. Keep the other arguments the same. Minimum length: 1.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

### Response fields

| Field              | Type           | Required | Description                                              |
| ------------------ | -------------- | -------- | -------------------------------------------------------- |
| `framework`        | Framework      | Yes      |                                                          |
| `frameworkVersion` | string or null | Yes      |                                                          |
| `total`            | integer        | Yes      | All matching items, on every page.                       |
| `nextCursor`       | string or null | Yes      | Pass it as `cursor` for the next page; null on the last. |
| `diagnostics`      | Diagnostic[]   | Yes      | One page of problems, in file order.                     |
| `hint`             | string or null | Yes      | What to do next, when there is something to say.         |

Nested test records use the [core output format](https://huldoser.github.io/test-inventory/reference/output).

### Complete example

```json
{
  "name": "scan_diagnostics",
  "arguments": {
    "levels": ["error"],
    "limit": 2
  }
}
```

Response:

```json
{
  "framework": "playwright",
  "frameworkVersion": "1.63.0",
  "total": 0,
  "diagnostics": [],
  "nextCursor": null,
  "hint": null
}
```

## diff_inventories

Available since MCP 0.8.0. Arguments added later have their own compatibility requirements; see [versioning](../README.md#versioning).

Compares two complete saved JSON scans inside the project, without running tests or changing files. Reports additions, removals, renames, moves, code and dependency changes, states, tags and other metadata. Uses ids first, then unique body hashes and file, suite or dependency context; ambiguous matches remain added and removed. Use the same framework, root, patterns, filters and expandCases for both saved scans. Hash comparisons and rename matching are disabled across tool versions. Follow nextCursor for more changes. For Playwright, Vitest, Jest, Mocha, Jasmine, Cypress, WebdriverIO, node:test and Bun inventories. Example: {"before":"inventories/base.json","after":"inventories/head.json"}.

### Arguments

| Field    | Type    | Required | Description                                                                                                   |
| -------- | ------- | -------- | ------------------------------------------------------------------------------------------------------------- |
| `before` | string  | Yes      | The old complete JSON inventory, relative to the project root; at most 128 MiB. Minimum length: 1.            |
| `after`  | string  | Yes      | The new complete JSON inventory, relative to the project root; at most 128 MiB. Minimum length: 1.            |
| `limit`  | integer | No       | The most items to return. Default: `50`. Minimum: 1. Maximum: 200.                                            |
| `cursor` | string  | No       | nextCursor from the previous answer, for the next page. Keep the other arguments the same. Minimum length: 1. |

### Response fields

| Field               | Type           | Required | Description                                                                                            |
| ------------------- | -------------- | -------- | ------------------------------------------------------------------------------------------------------ |
| `schemaVersion`     | integer        | Yes      |                                                                                                        |
| `tool`              | Tool           | Yes      |                                                                                                        |
| `framework`         | Framework      | Yes      |                                                                                                        |
| `beforeToolVersion` | string         | Yes      |                                                                                                        |
| `afterToolVersion`  | string         | Yes      |                                                                                                        |
| `hashesComparable`  | boolean        | Yes      |                                                                                                        |
| `summary`           | object         | Yes      | Category counts overlap; changed counts matched tests, while unchanged counts matches with no changes. |
| `changes`           | TestChange[]   | Yes      |                                                                                                        |
| `warnings`          | string[]       | Yes      |                                                                                                        |
| `total`             | integer        | Yes      | All matching items, on every page.                                                                     |
| `nextCursor`        | string or null | Yes      | Pass it as `cursor` for the next page; null on the last.                                               |
| `hint`              | string or null | Yes      | What to do next, when there is something to say.                                                       |

Nested test records use the [core output format](https://huldoser.github.io/test-inventory/reference/output).

### Complete example

```json
{
  "name": "diff_inventories",
  "arguments": {
    "before": "before.json",
    "after": "after.json",
    "limit": 1
  }
}
```

Response:

```json
{
  "schemaVersion": 1,
  "tool": {
    "name": "test-inventory",
    "version": "0.10.2"
  },
  "framework": "playwright",
  "beforeToolVersion": "0.10.2",
  "afterToolVersion": "0.10.2",
  "hashesComparable": true,
  "summary": {
    "added": 0,
    "removed": 0,
    "moved": 0,
    "renamed": 0,
    "bodyChanged": 0,
    "dependenciesChanged": 1,
    "newlySkipped": 1,
    "reEnabled": 0,
    "stateChanged": 1,
    "tagsChanged": 0,
    "metadataChanged": 1,
    "changed": 1,
    "unchanged": 30
  },
  "warnings": [],
  "changes": [
    {
      "kinds": ["dependenciesChanged", "newlySkipped", "stateChanged", "metadataChanged"],
      "match": "id",
      "before": {
        "id": "c5e380de5d1489e7",
        "bodyHash": "7e88c071a1b22e35",
        "dependencyHash": "39e8ee1d327b67af",
        "dependencies": [
          "fixtures/index.ts",
          "pages/login-page.ts",
          "playwright.config.ts",
          "test-data/accounts.ts",
          "tests/login.spec.ts"
        ],
        "hasUnfollowedDependencies": false,
        "suiteId": "d9caec00cd2537da",
        "parentTestId": null,
        "suitePath": ["login"],
        "relativeFilePath": "tests/login.spec.ts",
        "fileName": "login.spec.ts",
        "lineStart": 9,
        "lineEnd": 12,
        "columnStart": 3,
        "columnEnd": 5,
        "declaredAt": null,
        "title": "signs in with email and password",
        "titleWithoutTags": "signs in with email and password",
        "hasDynamicTitle": false,
        "fullName": "login > signs in with email and password",
        "isTypeTest": false,
        "state": "active",
        "isActive": true,
        "isSkipped": false,
        "isFixme": false,
        "isTodo": false,
        "isExpectedToFail": false,
        "isNotLoaded": false,
        "isOnly": false,
        "isConditional": false,
        "condition": null,
        "reason": null,
        "hasDynamicReason": false,
        "stateSource": null,
        "stateLine": null,
        "isParallel": false,
        "isSerial": false,
        "tags": ["@smoke"],
        "annotations": [],
        "comments": [],
        "locks": [],
        "meta": null,
        "hooks": {
          "beforeAll": 0,
          "beforeEach": 1,
          "afterEach": 0,
          "afterAll": 0,
          "aroundEach": 0,
          "aroundAll": 0
        },
        "timeout": null,
        "isSlow": false,
        "slowCondition": null,
        "retries": null,
        "retryDelay": null,
        "retryCondition": null,
        "repeats": null,
        "timeoutSource": null,
        "retriesSource": "config",
        "repeatsSource": null,
        "timeoutConfigText": null,
        "retriesConfigText": "process.env.CI ? 2 : 0",
        "repeatsConfigText": null,
        "fixtures": ["loginPage", "page"],
        "expectCount": 1,
        "expectedAssertions": null,
        "expectsAssertions": false,
        "hasEmptyBody": false,
        "steps": [],
        "isBenchmark": false,
        "isParameterized": false,
        "caseCount": null,
        "caseIndex": null,
        "isInLoop": false,
        "isInCondition": false,
        "isInFunction": false,
        "projects": ["chromium", "webkit", "mobile-smoke"]
      },
      "after": {
        "id": "c5e380de5d1489e7",
        "bodyHash": "7e88c071a1b22e35",
        "dependencyHash": "94a0c5bc7648c09e",
        "dependencies": [
          "fixtures/index.ts",
          "pages/login-page.ts",
          "playwright.config.ts",
          "test-data/accounts.ts",
          "tests/login.spec.ts"
        ],
        "hasUnfollowedDependencies": false,
        "suiteId": "d9caec00cd2537da",
        "parentTestId": null,
        "suitePath": ["login"],
        "relativeFilePath": "tests/login.spec.ts",
        "fileName": "login.spec.ts",
        "lineStart": 9,
        "lineEnd": 12,
        "columnStart": 3,
        "columnEnd": 5,
        "declaredAt": null,
        "title": "signs in with email and password",
        "titleWithoutTags": "signs in with email and password",
        "hasDynamicTitle": false,
        "fullName": "login > signs in with email and password",
        "isTypeTest": false,
        "state": "skip",
        "isActive": false,
        "isSkipped": true,
        "isFixme": false,
        "isTodo": false,
        "isExpectedToFail": false,
        "isNotLoaded": false,
        "isOnly": false,
        "isConditional": false,
        "condition": null,
        "reason": null,
        "hasDynamicReason": false,
        "stateSource": "test",
        "stateLine": 9,
        "isParallel": false,
        "isSerial": false,
        "tags": ["@smoke"],
        "annotations": [],
        "comments": [],
        "locks": [],
        "meta": null,
        "hooks": {
          "beforeAll": 0,
          "beforeEach": 1,
          "afterEach": 0,
          "afterAll": 0,
          "aroundEach": 0,
          "aroundAll": 0
        },
        "timeout": null,
        "isSlow": false,
        "slowCondition": null,
        "retries": null,
        "retryDelay": null,
        "retryCondition": null,
        "repeats": null,
        "timeoutSource": null,
        "retriesSource": "config",
        "repeatsSource": null,
        "timeoutConfigText": null,
        "retriesConfigText": "process.env.CI ? 2 : 0",
        "repeatsConfigText": null,
        "fixtures": ["loginPage", "page"],
        "expectCount": 1,
        "expectedAssertions": null,
        "expectsAssertions": false,
        "hasEmptyBody": false,
        "steps": [],
        "isBenchmark": false,
        "isParameterized": false,
        "caseCount": null,
        "caseIndex": null,
        "isInLoop": false,
        "isInCondition": false,
        "isInFunction": false,
        "projects": ["chromium", "webkit", "mobile-smoke"]
      },
      "changedFields": ["dependencyHash", "isActive", "isSkipped", "state", "stateSource"]
    }
  ],
  "total": 1,
  "nextCursor": null,
  "hint": null
}
```

## No matches and recovery

A valid query with no matches is not an error. For find_tests with an exact title pattern absent from the fixture:

```json
{
  "framework": "playwright",
  "frameworkVersion": "1.63.0",
  "total": 0,
  "tests": [],
  "nextCursor": null,
  "scanErrors": 0,
  "hint": "No test matches; the scan found 31 tests in 11 files."
}
```

An invalid argument is a tool error. For find_tests with limit 201, the response has isError: true and this corrective content:

```json
[
  {
    "type": "text",
    "text": "Input validation error: Invalid arguments for tool find_tests: limit: Too big: expected number to be <=200"
  }
]
```

Use a limit from 1 to 200 and retry. A stale or changed cursor requires starting again without cursor. For scan errors, inspect scan_diagnostics and fix the named file, import or config; a zero error count still cannot prove static analysis discovered every runtime-generated test.

See [troubleshooting](../README.md#troubleshooting) for project roots, missing ids, refused paths and saved inventory requirements.
