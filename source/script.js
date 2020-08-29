/* global fieldProperties, setAnswer, XMLHttpRequest, ActiveXObject, btoa, getPluginParameter, getMetaData, setMetaData */

var radioButtonsContainer = document.getElementById('radio-buttons-container') // default radio buttons
var selectDropDownContainer = document.getElementById('select-dropdown-container') // minimal appearance
var confirmationContainer = document.querySelector('#confirmation-container')
var confirmationAction = document.querySelector('#confirm-action')
var yesButton = document.querySelector('#yes')
var noButton = document.querySelector('#no')
var waitingContainer = document.querySelector('#waiting')

var action = getPluginParameter('action')
var callurl = getPluginParameter('call_url')
var authToken = getPluginParameter('auth_token')
var timeout = getPluginParameter('timeout')
var waitingText = getPluginParameter('waiting_text')
var completeText = getPluginParameter('complete_text')
var yesText = getPluginParameter('Yes')
var noText = getPluginParameter('No')

// Default parameter values
if (waitingText == null) {
  waitingText = 'Enumerator: Please wait...'
}
if (completeText == null) {
  completeText = 'All set! You can now move to the next field.'
}
if (yesText != null) {
  yesButton.innerHTML = yesText
}
if (noText != null) {
  noButton.innerHTML = noText
}
if (timeout == null) {
  timeout = 8000
} else {
  timeout = parseInt(timeout) * 1000
}

var accountSID
var callSID
var recordingurl // This will be retrieved using the call URL.

var selectedChoice // This will store the choice selected, 1 or 0. When the answer is ready to be set (meaning the enumerator can move on to the next field), this will be used in the setAnswer() function.
var errorFound = false // If an error is found, then field plug-in will not work properly
var errorLogs = [] // Stores all errors when setting up the field plug-in. Hopefully won't be needed, since errors should be addressed by the form designer before deploying the form.

// Timing vars
var timePassed = 0
var startTime // This will store the current Unix time as soon as an action is executed. That way, if too much time passes, then it will allow the enumerator to move on.
var timerRunning = false // Timer starts when an action is executed.

var numComplete = 0 // How many of the recording actions have been completed. For example, if there are 5 recordings for a call. then this will slowly increase to 5

if (action == null) {
  foundError('No action to take found')
}

if (callurl == null) {
  foundError('No call information detected. Please go back and make a call.')
} else {
  var beforeExt = callurl.match(/https:\/\/api\.twilio\.com\/[^.]+/g) // Before the .json part
  if (beforeExt == null) {
    selectedChoice = 0
    foundError('Was unable to retrieve call information. Please report this issue to your manager.')
    completeField('0|No valid URI to call or recordings')
  } else {
    recordingurl = beforeExt[0] + '/Recordings.json'
  }
} // End callurl found

try { // Look for account SID
  accountSID = recordingurl.match(/AC[^/]+/g)[0]
} catch (e) {
  foundError('Missing account SID. Make sure the recording URL or the call URL contains a code that starts with "AC".')
}

try { // Look for call SID
  callSID = recordingurl.match(/CA[^/]+/g)[0]
} catch (e) {
  foundError('Missing call SID. Make sure the recording URL or the call URL contains a code that starts with "CA".')
}

confirmationContainer.style.display = 'none' // Hide the yes/no buttons until ready

// Prepare the current webview, making adjustments for any appearance options

// minimal appearance
if (fieldProperties.APPEARANCE.includes('minimal') === true) {
  radioButtonsContainer.parentElement.removeChild(radioButtonsContainer) // remove the default radio buttons
  selectDropDownContainer.style.display = 'block' // show the select dropdown
} else { // all other appearances
  if (fieldProperties.LANGUAGE !== null && isRTL(fieldProperties.LANGUAGE)) {
    radioButtonsContainer.dir = 'rtl'
  }
  selectDropDownContainer.parentElement.removeChild(selectDropDownContainer) // remove the select dropdown container
}

// minimal appearance
if (fieldProperties.APPEARANCE.includes('minimal') === true) {
  selectDropDownContainer.onchange = change // when the select dropdown is changed, call the change() function (which will update the current value)
} else { // all other appearances
  var buttons = document.querySelectorAll('input[name="opt"]')
  for (var i = 0; i < buttons.length; i++) {
    buttons[i].onchange = function () {
      // remove 'selected' class from a previously selected option (if any)
      var selectedOption = document.querySelector('.choice-container.selected')
      if (selectedOption) {
        selectedOption.classList.remove('selected')
      }
      this.parentElement.classList.add('selected') // add 'selected' class to the new selected option
      change.apply(this) // call the change() function and tell it which value was selected
    }
  }
}

if (fieldProperties.LABEL) {
  document.querySelector('.label').innerHTML = unEntity(fieldProperties.LABEL)
}
if (fieldProperties.HINT) {
  document.querySelector('.hint').innerHTML = unEntity(fieldProperties.HINT)
}

setInterval(timer, 10)

// Define what happens when the user attempts to clear the response
function clearAnswer () {
  // minimal appearance
  if (fieldProperties.APPEARANCE.includes('minimal') === true) {
    selectDropDownContainer.value = ''
  } else { // all other appearances
    var selectedOption = document.querySelector('input[name="opt"]:checked')
    if (selectedOption) {
      selectedOption.checked = false
      selectedOption.parentElement.classList.remove('selected')
    }
  }
  setAnswer('')
  setMetaData()
}

// Detect right-to-left languages
function isRTL (s) {
  var ltrChars = 'A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02B8\u0300-\u0590\u0800-\u1FFF' + '\u2C00-\uFB1C\uFDFE-\uFE6F\uFEFD-\uFFFF'
  var rtlChars = '\u0591-\u07FF\uFB1D-\uFDFD\uFE70-\uFEFC'
  var rtlDirCheck = new RegExp('^[^' + ltrChars + ']*[' + rtlChars + ']')

  return rtlDirCheck.test(s)
}

function startTimer () {
  startTime = Date.now()
  timerRunning = true
}

function timer () { // Timer starts running after an action has started. After a period of time, times out, and allows the enumerator to continue
  if (timerRunning) {
    timePassed = Date.now() - startTime
    if ((timePassed >= timeout) && (getMetaData() == null)) {
      completeField('0|Ran out of time')
    }
  }
}

// Start HTTP functions

function makeHttpObject () {
  try {
    return new XMLHttpRequest()
  } catch (error) { }
  try {
    return new ActiveXObject('Msxml2.XMLHTTP')
  } catch (error) { }
  try {
    return new ActiveXObject('Microsoft.XMLHTTP')
  } catch (error) { }

  throw new Error('Could not create HTTP request object.')
}

// type: Type of request, such as GET or POST
// runFunction: Function to run when response is received
function createHttpRequest (type, requestUrl, params = undefined, runFunction, newParams) {
  var request
  var responseText = getMetaData()

  try {
    request = makeHttpObject()

    request.open(type, requestUrl, true)
    request.setRequestHeader('Authorization', 'Basic ' + btoa(unescape(encodeURIComponent(accountSID + ':' + authToken))))
    request.setRequestHeader('Content-type', 'application/x-www-form-urlencoded')

    request.onreadystatechange = function () {
      if (request.readyState === 4) {
        responseText = request.responseText

        if (request.status === 0) {
          completeField('0|Unable to connect to internet')
        } else if (!responseText) {
          completeField('0|No response from Twilio')
        } else {
          runFunction(JSON.parse(responseText), newParams)
        }
      }
    }
    request.send(params)
  } catch (error) {
    completeField('0|' + String(error))
  }
}

function getRecordingInfo (nextFunction) {
  createHttpRequest('GET', recordingurl, undefined, nextFunction)
}

// After receiving the call information, extracts the recording information, and stops all recordings
function stopRecordings (requestText) {
  var recordingArray = requestText.recordings
  var numRecordings = recordingArray.length

  var urls = [] // List of recording URLs that need to be stopped

  for (var r = 0; r < numRecordings; r++) {
    var requestUrl
    var recordingInfo = recordingArray[r]
    var recordingSID = recordingInfo.sid
    var recordingStatus = recordingInfo.status

    if (recordingStatus !== 'completed') { // If not completed, then added to list of recordings that need to be stopped
      requestUrl = 'https://api.twilio.com/2010-04-01/Accounts/' + accountSID + '/Calls/' + callSID + '/Recordings/' + recordingSID + '.json'
      urls.push(requestUrl)
    } // End checking recording status
  } // End FOR loop through each recording

  var numUrls = urls.length
  if (numUrls === 0) { // If this is true, then all have already been stopped
    completeField('2|No recordings had been started, so there were none to delete.')
  } else {
    for (var s = 0; s < numUrls; s++) { // Go through each recording that has not yet been stopped and stops them
      requestUrl = urls[s]
      createHttpRequest('POST', requestUrl, 'Status=stopped', actionComplete, numUrls)
    } // End FOR through each recording that has not been stopped
  } // End running recordings found
} // End stopRecordings function

// After receiving the call information, extracts the recording information, and stops and deletes all recordings
function deleteRecordings (requestText) {
  var recordingArray = requestText.recordings
  var numRecordings = recordingArray.length

  if (numRecordings === 0) { // If there are no recordings, then nothing to worry about!
    completeField('2|No recordings found.')
  } else {
    for (var r = 0; r < numRecordings; r++) {
      var requestUrl
      var recordingInfo = recordingArray[r]
      var recordingSID = recordingInfo.sid
      var recordingStatus = recordingInfo.status

      if (recordingStatus === 'completed') {
        requestUrl = 'https://api.twilio.com/2010-04-01/Accounts/' + accountSID + '/Recordings/' + recordingSID + '.json'
        createHttpRequest('DELETE', requestUrl, undefined, actionComplete, numRecordings)
      } else { // If not completed, then need to stop the recording before deleting it
        requestUrl = 'https://api.twilio.com/2010-04-01/Accounts/' + accountSID + '/Calls/' + callSID + '/Recordings/' + recordingSID + '.json'
        createHttpRequest('POST', requestUrl, 'Status=stopped', deleteSingleRecording, numRecordings)
      } // End checking recording status
    } // End FOR loop through each recording
  }
} // End deleteRecordings

// This is called if a recording had not yet been stopped. After the recording has been stopped, this deletes it
function deleteSingleRecording (requestText, recNumbers) {
  if (requestText.status === 'stopped') {
    var recordingSID = requestText.sid
    var requestUrl = 'https://api.twilio.com/2010-04-01/Accounts/' + accountSID + '/Recordings/' + recordingSID + '.json'
    createHttpRequest('DELETE', requestUrl, undefined, actionComplete, recNumbers)
  } else {
    // ERROR while attempting to stop recording
  }
} // End deleteSingleRecording

// This is called when an action is complete (such as if a recording has been stopped). When the script has gone through all of the recordings, it is time to check the recording status.
function actionComplete (requestText, numRecordings) { // The requestText is not used here, but it is needeed as a parameter so that it can be used when the HTTP request is complete
  numComplete++
  if (numComplete === numRecordings) { // If on the final recording (e.g. recording 5 of 5), then can set the answer
    checkRecordingStatus()
  }
}

// Checks to confirm the recording has been started.
function recordingStarted (requestText) {
  var recordingStatus = requestText.status
  if (recordingStatus === 'in-progress') {
    var recordingUri = requestText.uri
    completeField('1|https://api.twilio.com' + recordingUri)
  } else {
    completeField('0|Failed to start recording.')
  }
}

// This is run after all commands to stop or delete the recordings are complete. This checks to make sure it was successful.
function checkRecordingStatus () {
  getRecordingInfo(confirmRecordingStatus)
}

// This function does final checks to make sure everything went well, and then sets the answer
function confirmRecordingStatus (requestText) {
  var recordingInfo = requestText.recordings
  var numRecordings = recordingInfo.length

  if ((numRecordings > 0) && (action === 'delete')) {
    var rsidArray = []
    for (var r = 0; r < numRecordings; r++) {
      var sid = recordingInfo[r].sid
      rsidArray.push(sid)
    }
    var allNotDeleted = rsidArray.join(', ')
    completeField('0|The following recordings were not deleted: ' + allNotDeleted)
  } else {
    completeField('1|All recordings were successfully deleted')
  }
} // End confirmRecordingStatus

// Sets the metadata and answer after everything is complete.
function completeField (result) {
  timerRunning = false
  setMetaData(result)
  setAnswer(selectedChoice)
  waitingContainer.innerHTML = completeText
}

// Start other functions

function change () {
  confirmation(this.value)
}

// If the field label or hint contain any HTML that isn't in the form definition, then the < and > characters will have been replaced by their HTML character entities, and the HTML won't render. We need to turn those HTML entities back to actual < and > characters so that the HTML renders properly. This will allow you to render HTML from field references in your field label or hint.
function unEntity (str) {
  return str.replace(/&lt;/g, '<').replace(/&gt;/g, '>')
}

// Confirms that the enumerator selected "Yes" or "No", so that nothing is deleted or stopped by mistake
function confirmation (selected) {
  selectedChoice = selected
  confirmationContainer.style.display = 'block'
  if (selectedChoice === '0') {
    confirmationAction.innerHTML = 'not '
  } else {
    confirmationAction.innerHTML = ''
  }

  yesButton.onclick = function () {
    if (errorFound) { // If there was an error, instead of executing the action, reports that there was an error
      var allErrors = errorLogs.join('-')
      completeField('0|Did not receive all needed data-' + allErrors)
    } else {
      executeAction()
    }
  }

  noButton.onclick = function () {
    clearAnswer()
    confirmationContainer.style.display = 'none'
  }
} // End confirmtation

// Starts the execution of the action stopping, deletion, etc
function executeAction () {
  waitingContainer.innerHTML = waitingText
  startTimer()
  if (selectedChoice === '0') {
    if (action === 'delete') {
      getRecordingInfo(deleteRecordings)
    } else if (action === 'stop') {
      getRecordingInfo(stopRecordings)
    } else {
      completeField('2|No action needed to be taken')
    }
  } else if (selectedChoice === '1') {
    if (action === 'start') {
      var requestUrl = 'https://api.twilio.com//2010-04-01/Accounts/' + accountSID + '/Calls/' + callSID + '/Recordings.json'
      var params = 'RecordingStatusCallbackEvent=in-progress completed absent'
      createHttpRequest('POST', requestUrl, params, recordingStarted)
    } else {
      completeField('2|No action needed to be taken')
    }
  }
} // End executeAction

// If an error was already found, then adds the error message.
function foundError (message) {
  errorLogs.push(message)
  if (errorFound) {
    waitingContainer.innerHTML += '\n<br>' + message
  } else {
    errorFound = true
    waitingContainer.innerHTML = 'There was an issue when loading the call information<br>\n<br>\n' + message
  }
}
