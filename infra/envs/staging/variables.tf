variable "state_passphrase" {
  description = "Hasło szyfrowania stanu OpenTofu (min. 16 znaków). Sekret CI: TOFU_STATE_PASSPHRASE."
  type        = string
  sensitive   = true
}

variable "hcloud_token" {
  type      = string
  sensitive = true
}

variable "cloudflare_api_token" {
  type      = string
  sensitive = true
}

variable "cloudflare_account_id" {
  type = string
}

variable "cloudflare_zone_id" {
  type = string
}

variable "name" {
  type    = string
  default = "factory"
}

variable "location" {
  type    = string
  default = "fsn1"
}

variable "api_hostname" {
  description = "Pełna nazwa hosta API, np. api.example.com"
  type        = string
}

variable "ssh_public_keys" {
  description = "Klucze publiczne z dostępem do użytkownika deploy."
  type        = list(string)
}

variable "admin_cidrs" {
  description = "Adresy z dostępem SSH (CI + administratorzy). Domyślnie wszędzie; zawęź w produkcji."
  type        = list(string)
  default     = ["0.0.0.0/0", "::/0"]
}
