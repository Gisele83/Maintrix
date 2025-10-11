# -*- mode: ruby -*-
# vi: set ft=ruby :

Vagrant.configure("2") do |config|
  # Configuration VM Windows Server 2022
  config.vm.box = "gusztavvargadr/windows-server-2022-standard"
  
  # Configuration réseau
  config.vm.network "private_network", ip: "192.168.56.10"
  config.vm.network "forwarded_port", guest: 5000, host: 5000, host_ip: "127.0.0.1"
  config.vm.network "forwarded_port", guest: 5432, host: 5432, host_ip: "127.0.0.1"
  
  # Nom de la VM
  config.vm.hostname = "maintrix-server"
  
  # Configuration VirtualBox
  config.vm.provider "virtualbox" do |vb|
    vb.name = "Maintrix-Windows-VM"
    vb.memory = "4096"
    vb.cpus = 2
    vb.gui = false
    
    # Optimisations performances
    vb.customize ["modifyvm", :id, "--vram", "128"]
    vb.customize ["modifyvm", :id, "--clipboard", "bidirectional"]
    vb.customize ["modifyvm", :id, "--draganddrop", "bidirectional"]
  end
  
  # Configuration Hyper-V (alternative)
  config.vm.provider "hyperv" do |hv|
    hv.vmname = "Maintrix-Windows-VM"
    hv.memory = 4096
    hv.cpus = 2
    hv.enable_virtualization_extensions = true
    hv.linked_clone = true
  end
  
  # Copier les fichiers du projet dans la VM
  config.vm.synced_folder ".", "/maintrix", type: "rsync",
    rsync__exclude: [".git/", "node_modules/", "dist/", ".env"]
  
  # Provisioning automatique
  config.vm.provision "shell", path: "vm-setup-windows.ps1"
  
  # Message de bienvenue
  config.vm.post_up_message = <<-MSG
  ╔═══════════════════════════════════════════════════════════╗
  ║          🔧 MAINTRIX VM WINDOWS DÉMARRÉE                  ║
  ╟───────────────────────────────────────────────────────────╢
  ║  Accès Web:     http://localhost:5000                     ║
  ║  Base de données: localhost:5432                          ║
  ║  IP VM:         192.168.56.10                            ║
  ║                                                           ║
  ║  Se connecter:  vagrant ssh                              ║
  ║  Arrêter:       vagrant halt                             ║
  ║  Détruire:      vagrant destroy                          ║
  ╚═══════════════════════════════════════════════════════════╝
  MSG
end
