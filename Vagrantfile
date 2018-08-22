Vagrant.configure("2") do |config|
    config.vm.box = "ubuntu/bionic64"

    config.vm.provision "shell", path: "scripts/bootstrap.bash"
    config.vm.provision "shell", path: "scripts/node.bash", privileged: false
end
