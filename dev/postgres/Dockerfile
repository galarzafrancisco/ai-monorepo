# postgres:16-alpine plus pgvector, which semantic search needs.
#
# Built on the same Alpine base as before on purpose: the official pgvector
# image is Debian (glibc), and opening a data directory created on Alpine
# (musl) there changes text sort order and can corrupt existing indexes.
FROM postgres:16-alpine

ARG PGVECTOR_VERSION=v0.8.7

RUN apk add --no-cache --virtual .pgvector-build build-base git \
  && git clone --branch "$PGVECTOR_VERSION" --depth 1 https://github.com/pgvector/pgvector.git /tmp/pgvector \
  && cd /tmp/pgvector \
  # OPTFLAGS="" drops -march=native so the image runs on any CPU of this architecture.
  && make OPTFLAGS="" with_llvm=no \
  && make install with_llvm=no \
  && rm -rf /tmp/pgvector \
  && apk del .pgvector-build
