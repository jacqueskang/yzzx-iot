locals {
  # Clean suffix for resources that need lowercase alphanumerics (e.g., storage account)
  suffix_clean = substr(replace(lower(var.suffix), "/[^a-z0-9]/", ""), 0, 12)
}
