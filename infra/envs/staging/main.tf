terraform {
  required_version = ">= 1.9"

  required_providers {
    hcloud     = { source = "hetznercloud/hcloud", version = "~> 1.52" }
    cloudflare = { source = "cloudflare/cloudflare", version = "~> 5.8" }
  }

  # Stan w Cloudflare R2 (API S3). Bucket, endpoint i klucze podaje CI przez -backend-config
  # (patrz .github/workflows/ci.yml, job "tofu"). Klucz stanu: staging/terraform.tfstate.
  backend "s3" {
    key                         = "staging/terraform.tfstate"
    region                      = "auto"
    skip_credentials_validation = true
    skip_region_validation      = true
    skip_requesting_account_id  = true
    skip_metadata_api_check     = true
    skip_s3_checksum            = true
    use_path_style              = true
  }

  # Natywne szyfrowanie stanu i planu OpenTofu (AES-GCM, klucz z hasła PBKDF2).
  encryption {
    key_provider "pbkdf2" "main" {
      passphrase = var.state_passphrase
    }
    method "aes_gcm" "main" {
      keys = key_provider.pbkdf2.main
    }
    state {
      method   = method.aes_gcm.main
      enforced = true
    }
    plan {
      method   = method.aes_gcm.main
      enforced = true
    }
  }
}

provider "hcloud" {
  token = var.hcloud_token
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

module "app" {
  source = "../../modules/app"

  name                  = var.name
  environment           = "staging"
  server_type           = "cx23"
  location              = var.location
  ssh_public_keys       = var.ssh_public_keys
  admin_cidrs           = var.admin_cidrs
  cloudflare_account_id = var.cloudflare_account_id
  cloudflare_zone_id    = var.cloudflare_zone_id
  api_hostname          = var.api_hostname
  backup_retention_days = 7
}

output "server_ipv4" {
  value = module.app.server_ipv4
}

output "api_url" {
  value = module.app.api_url
}

output "backup_bucket" {
  value = module.app.backup_bucket
}
