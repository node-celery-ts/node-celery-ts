#!/usr/bin/env sh

apt-get update
apt-get upgrade -y

if [ ! -e /usr/local/bin/rabbitmqctl ]; then
	ln -s /vagrant/scripts/rabbitmqctl.sh /usr/local/bin/rabbitmqctl
fi

if [ ! -e /usr/local/bin/redis-cli ]; then
	ln -s /vagrant/scripts/redis-cli.sh /usr/local/bin/redis-cli
fi
