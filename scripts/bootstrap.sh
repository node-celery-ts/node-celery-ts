#!/usr/bin/env sh

apt-get update
apt-get upgrade -y

rm -f /usr/local/bin/rabbitmqctl
cp /vagrant/scripts/rabbitmqctl.sh /usr/local/bin/rabbitmqctl
chmod +x /usr/local/bin/rabbitmqctl

rm -f /usr/local/bin/redis-cli
cp /vagrant/scripts/redis-cli.sh /usr/local/bin/redis-cli
chmod +x /usr/local/bin/redis-cli
