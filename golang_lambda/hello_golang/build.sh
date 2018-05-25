#!/bin/bash

echo building go executable...

docker run --rm -v "$PWD":/tmp -w /tmp galacticfog/build-go:1.0 /bin/bash -c "go build $1"
