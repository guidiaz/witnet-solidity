/* eslint-disable no-unused-vars */

const Witnet = require("witnet-toolkit")

const retrievals = require("./retrievals")
const templates = require("./templates")
 
module.exports = {
  /// //// REQUESTS FROM RETRIEVALS /////////////////////////////////////////////////
  // path: { ... path: {
  //      WitOracleRequestXXX: Witnet.Radon.Request({
  //          retrieve: [ 
  //              retrievals...RadonRetrieval1,
  //              retrievals...RadonRetrieval2.foldArgs("value21"),
  //              retrievals...RadonRetrieval3.foldArgs("value31", "value32"),
  //              ... 
  //          ],
  //          aggregate?: Witnet.Radon.Reducers..,
  //          tally?: Witnet.Radon.Reducers..,
  //      }),
  /// /// REQUESTS FROM TEMPLATE ///////////////////////////////////////////////////
  //      WitOracleRequestYYY: Witnet.Radon.RequestFromTemplate(
  //          templates..WitOracleRequestTemplateYY1,
  //          ...params: string[] | string[][]
  //      })
  // }, ... },
}
