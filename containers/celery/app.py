import celery

app = celery.Celery('tasks')

app.conf.update(
    broker_url="amqp://rabbitmq",
    result_backend="redis://redis",
)

if __name__ == '__main__':
app.start()
