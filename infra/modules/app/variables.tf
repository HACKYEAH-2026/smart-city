variable "name" {
  type = string
}

variable "environment" {
  type = string
  validation {
    condition     = contains(["staging", "prod"], var.environment)
    error_message = "environment: staging albo prod."
  }
}

variable "server_type" {
  type = string
}

variable "location" {
  type = string
}

variable "image" {
  type    = string
  default = "ubuntu-24.04"
}

variable "ssh_public_keys" {
  type = list(string)
}

variable "admin_cidrs" {
  type = list(string)
}

variable "cloudflare_account_id" {
  type = string
}

variable "cloudflare_zone_id" {
  type = string
}

variable "api_hostname" {
  type = string
}

variable "backup_retention_days" {
  type = number
}
