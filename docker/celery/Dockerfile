FROM python:latest

WORKDIR /usr/src/app

COPY app.py requirements.txt tasks.py ./
RUN pip install --no-cache-dir -r ./requirements.txt

RUN groupadd -g 768 celery && useradd -r -u 768 -g celery celery
USER celery

CMD [ "celery", "-A", "tasks", "worker", "--loglevel=info" ]
