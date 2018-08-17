#!/usr/bin/env sh

if ! docker network ls --format "{{.Name}}" | grep -Fxq celery; then
    docker network create celery
fi
