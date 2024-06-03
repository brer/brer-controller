# declare image
FROM node:20-alpine as build

# cd into app dir
WORKDIR /home/app/node

# copy sources
COPY package*.json ./
COPY tsconfig*.json ./
COPY src src/

# build app
RUN npm install \
  && npm run build \
  && npm prune --omit=dev \
  && rm -rf src

# declare new (empty) image
FROM node:20-alpine

# cd into app dir
WORKDIR /home/app/node

# get files from build image
COPY --from=build /home/app/node .

# setup security
RUN adduser --disabled-password -s /bin/false app \
  && chown -R app:app /home/app

# use app user
USER app

# run app
CMD ["sh", "-c", "node ./build/start.js"]
