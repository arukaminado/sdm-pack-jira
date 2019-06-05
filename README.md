<p align="center">
  <img src="https://images.atomist.com/sdm/SDM-Logo-Dark.png">
</p>

# @atomist/sdm-pack-jira
[![atomist sdm goals](https://badge.atomist.com/T29E48P34/atomist/sdm-pack-jira/dbc6d7f1-931b-48e3-a59c-848bf516b44d)](https://app.atomist.com/workspace/T29E48P34)
[![npm version](https://img.shields.io/npm/v/@atomist/sdm-pack-jira.svg)](https://www.npmjs.com/package/@atomist/sdm-pack-jira)

To add support for JIRA to your SDM install this pack into your package.json and add the following to your `machine.ts` file:

```typescript
    sdm.addExtensionPacks(
        jiraSupport(),
    );
```

Next, add the relevant configuration to your Atomist config:

```typescript
    "jira": {
      "url": "https://jirahostname",
      "vcstype": "github",
      "user": "",
      "password": "",
      "useDynamicChannels": boolean,
      "useCache": boolean
    },
```

`url`: The base URL for your JIRA instance

`vcstype`: The type of version control system you have linked to JIRA, if any

`user`: A service account Atomist can use to interact with JIRA

`password`: The service account password

`useDynamicChannels`: Should Atomist automatically determine which channels to notify based on commits registered to this Issue?  If yes, Atomist will find that repository and it's linked channels in the graph to determine who to notify

`useCache`: Should the pack leverage a (configurable) caching solution to reduce the load on the JIRA server?


### About SDMs
Software delivery machines enable you to control your delivery process
in code.  Think of it as an API for your software delivery.  See the
[Atomist documentation][atomist-doc] for more information on the
concept of a software delivery machine and how to create and develop
an SDM.

[atomist-doc]: https://docs.atomist.com/ (Atomist Documentation)

## Getting started

See the [Developer Quick Start][atomist-quick] to jump straight to
creating an SDM.

[atomist-quick]: https://docs.atomist.com/quick-start/ (Atomist - Developer Quick Start)

## Contributing

Contributions to this project from community members are encouraged
and appreciated. Please review the [Contributing
Guidelines](CONTRIBUTING.md) for more information. Also see the
[Development](#development) section in this document.

## Code of conduct

This project is governed by the [Code of
Conduct](CODE_OF_CONDUCT.md). You are expected to act in accordance
with this code by participating. Please report any unacceptable
behavior to code-of-conduct@atomist.com.

## Documentation

Please see [docs.atomist.com][atomist-doc] for
[developer][atomist-doc-sdm] documentation.

[atomist-doc-sdm]: https://docs.atomist.com/developer/sdm/ (Atomist Documentation - SDM Developer)

## Connect

Follow [@atomist][atomist-twitter] and [The Composition][atomist-blog]
blog related to SDM.

[atomist-twitter]: https://twitter.com/atomist (Atomist on Twitter)
[atomist-blog]: https://the-composition.com/ (The Composition - The Official Atomist Blog)

## Support

General support questions should be discussed in the `#support`
channel in the [Atomist community Slack workspace][slack].

If you find a problem, please create an [issue][].

[issue]: https://github.com/atomist-seeds/sdm-pack/issues

## Development

You will need to install [Node.js][node] to build and test this
project.

[node]: https://nodejs.org/ (Node.js)

### Build and test

Install dependencies.

```
$ npm install
```

Use the `build` package script to compile, test, lint, and build the
documentation.

```
$ npm run build
```

### Release

Releases are handled via the [Atomist SDM][atomist-sdm].  Just press
the 'Approve' button in the Atomist dashboard or Slack.

[atomist-sdm]: https://github.com/atomist/atomist-sdm (Atomist Software Delivery Machine)

---

Created by [Atomist][atomist].
Need Help?  [Join our Slack workspace][slack].

[atomist]: https://atomist.com/ (Atomist - How Teams Deliver Software)
[slack]: https://join.atomist.com/ (Atomist Community Slack)
