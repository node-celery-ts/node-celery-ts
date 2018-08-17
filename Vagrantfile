Vagrant.configure("2") do |config|
    config.vm.box = "ubuntu/bionic64"

    config.vm.provision "shell", path: "scripts/bootstrap.sh"
    config.vm.provision "shell", path: "scripts/node.bash", privileged: false

    config.vm.provision "docker" do |d|
        d.images = ["rabbitmq:management", "redis:latest"]
        d.build_image "/vagrant/containers/celery", args: "-t celery"

        d.post_install_provision "shell", path: "scripts/docker.sh"

        d.run "rabbitmq",
            args: "--name rabbitmq --network celery -p 5672:5672"
        d.run "redis", args: "--name redis --network celery -p 6379:6379"
        d.run "celery",
            args: "--name celery --network celery"
    end
end
