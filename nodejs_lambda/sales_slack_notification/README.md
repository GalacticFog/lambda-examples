## Purpose
This lambda sends slack notifications using the latest nodejs es6 specification

## Pre-Reqs

[Configure your Slack for incoming webhooks](https://api.slack.com/incoming-webhooks)

## Input Values:
This lambda requires the following Environment Variables be set 

```
SLACK_API_BASEPATH=https://hooks.slack.com
SLACK_PATH=services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX
```

Body format
`{ "data": { "payload": "hello terra!" } }`

## Local Execution
localrc or export

```
export SLACK_API_BASEPATH=https://hooks.slack.com
export SLACK_PATH=services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX
```

```
laser-execute $(echo `pwd`)/index.js run '{ "data": { "payload": "hello terra!" } }'
```