FROM python:3.12-slim
WORKDIR /srv
COPY index.html /srv/index.html
COPY assets /srv/assets
EXPOSE 8080
CMD ["python", "-m", "http.server", "8080", "--bind", "0.0.0.0"]
