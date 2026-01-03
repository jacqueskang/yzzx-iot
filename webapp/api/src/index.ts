import { app } from "@azure/functions";
import "./functions/lights";
import "./functions/updateLightPosition";

app.setup({
  enableHttpStream: true,
});
