FROM cgr.dev/chainguard/minio-client:latest AS mc-bin
FROM alpine:3.20
RUN apk add --no-cache ca-certificates
COPY --from=mc-bin /usr/bin/mc /usr/bin/mc
COPY cors.json /etc/minio/cors.json
ENTRYPOINT ["/bin/sh"]


