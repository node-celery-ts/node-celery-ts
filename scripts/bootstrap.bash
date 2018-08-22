#!/usr/bin/env bash

apt-get update
apt-get upgrade -y

# install docker
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -
add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable"
apt-get update
apt-get -y install docker-ce

# install docker-compose
curl -L https://github.com/docker/compose/releases/download/1.22.0/docker-compose-$(uname -s)-$(uname -m) -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

rm -f /usr/local/bin/rabbitmqctl
cp /vagrant/scripts/rabbitmqctl.sh /usr/local/bin/rabbitmqctl
chmod +x /usr/local/bin/rabbitmqctl

rm -f /usr/local/bin/redis-cli
cp /vagrant/scripts/redis-cli.sh /usr/local/bin/redis-cli
chmod +x /usr/local/bin/redis-cli

pushd /vagrant/docker/
docker-compose up -d
popd
