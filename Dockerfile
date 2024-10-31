FROM node:18-slim

RUN apt-get update && apt-get install -y ca-certificates fonts-liberation libasound2 libnss3 libx11-xcb1 libxcomposite1 libxrandr2 chromium git && \
    rm -rf /var/lib/apt/lists/*

USER node

WORKDIR /app

RUN git clone https://github.com/marcoantonioq/siga-puppeteer.git . && npm install

EXPOSE 3000

CMD ["npm", "start"]