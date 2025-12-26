resource "azurerm_role_assignment" "func_storage_blob_contributor" {
  scope                = azurerm_storage_account.main.id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = azurerm_linux_function_app.main.identity[0].principal_id
}
resource "azurerm_role_assignment" "func_azure_digital_twins_data_owner" {
  scope                = azurerm_digital_twins_instance.main.id
  role_definition_name = "Azure Digital Twins Data Owner"
  principal_id         = azurerm_linux_function_app.main.identity[0].principal_id
}

resource "azurerm_role_assignment" "func_eventhub_receiver" {
  scope                = azurerm_iothub.main.id
  role_definition_name = "Azure Event Hubs Data Receiver"
  principal_id         = azurerm_linux_function_app.main.identity[0].principal_id
}
