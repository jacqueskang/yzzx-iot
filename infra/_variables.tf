variable "suffix" {
  default = "yzzx-iot"
  type    = string
}

variable "location" {
  default = "westeurope"
  type    = string
}

variable "tags" {
  description = "Resource tags"
  type        = map(string)
  default     = {
    stack = "yzzx-iot"
  }
}
