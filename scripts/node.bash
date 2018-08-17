#!/usr/bin/env bash

# install nvm and npm
wget -qO- https://raw.githubusercontent.com/creationix/nvm/v0.33.11/install.sh \
	| bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"
nvm install --lts
npm i -g npm

mkdir -p $HOME/node-celery-ts/
cp -r /vagrant/node-celery-ts/* $HOME/node-celery-ts/
cd $HOME/node-celery-ts/
npm i
