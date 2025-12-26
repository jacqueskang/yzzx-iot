resource "azurerm_storage_container" "function" {
  name                  = "function-flex-container"
  storage_account_id    = azurerm_storage_account.main.id
  container_access_type = "private"
}
