resource "azurerm_resource_group" "main" {
  name     = "rg-${var.suffix}"
  location = var.location
  tags     = var.tags
}
