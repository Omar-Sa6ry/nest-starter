# syntax=docker/dockerfile:1
FROM node:24-alpine

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci --legacy-peer-deps

EXPOSE 3000

CMD ["npm", "run", "start:dev"]
