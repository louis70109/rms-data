FROM python:3.12-slim
WORKDIR /srv
COPY server.py index.html manifest.json sw.js assets-manifest.json /srv/
COPY assets /srv/assets
EXPOSE 8080
CMD ["python", "server.py"]
