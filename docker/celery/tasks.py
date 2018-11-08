from app import app


@app.task
def add(x, y):
    return x + y


@app.task
def subtract(x, y):
    return x - y


@app.task
def multiply(x, y):
    return x * y


@app.task
def divide(x, y):
    return x / y


@app.task
def modulo(x, y):
    return x % y
