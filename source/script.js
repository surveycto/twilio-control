// Put this at the top of your script when testing in a web browser
class Choice {
  constructor (value, index, label, selected, image) {
    this.CHOICE_INDEX = index
    this.CHOICE_VALUE = String(value)
    this.CHOICE_LABEL = label
    if (selected) {
      this.CHOICE_SELECTED = true
    } else {
      this.CHOICE_SELECTED = false
    }
    this.CHOICE_IMAGE = image
  }
}

var fieldProperties = {
  CHOICES: [
    new Choice(1, 0, 'Yes'),
    new Choice(0, 1, 'No'),
  ],
  METADATA: '',
  LABEL: 'This is a label',
  HINT: 'This is a hint',
  PARAMETERS: [ // action callurl recordingurl authToken
    {
      key: 'action',
      value: getAction
    },
    {
      key: 'call_url',
      value: getCallurl
    },
    {
      key: 'recording_url',
      value: getRecordingurl
    },
    {
      key: 'auth_token',
      value: getAuthToken
    }
  ],
  FIELDTYPE: 'select_multiple',
  APPEARANCE: '',
  LANGUAGE: 'english'
}

function setAnswer (ans) {
  console.log('Set answer to: ' + ans)
}

function setMetaData (string) {
  fieldProperties.METADATA = string
}

function getMetaData () {
  return fieldProperties.METADATA
}

function getPluginParameter (param) {
  const parameters = fieldProperties.PARAMETERS
  if (parameters != null) {
    for (const p of fieldProperties.PARAMETERS) {
      const key = p.key
      if (key == param) {
        return p.value
      } // End IF
    } // End FOR
  } // End IF
}

function goToNextField () {
  console.log('Skipped to next field')
}

// setFocus() // Use this if your script includes a setFocus() function
// document.body.classList.add('android-collect') //
// Above for testing only */




/* global fieldProperties, setAnswer, clearAnswer, XMLHttpRequest, ActiveXObject, btoa */

var mainContainer = document.querySelector('#main-container')
var radioButtonsContainer = document.getElementById('radio-buttons-container') // default radio buttons
var selectDropDownContainer = document.getElementById('select-dropdown-container') // minimal appearance
var confirmationContainer = document.querySelector('#confirmation-container')
var confirmationAction = document.querySelector('#confirm-action')
var yesButton = document.querySelector('#yes')
var noButton = document.querySelector('#no')
var waitingContainer = document.querySelector('#waiting')

var action = getPluginParameter('action')
var callurl = getPluginParameter('call_url')
var recordingurl = getPluginParameter('recording_url')
var authToken = getPluginParameter('auth_token')

var accountSID
var callSID

var selectedChoice
var errorFound = false

if (action == null) {
  foundError('No action to take found')
}

if (recordingurl == null) {
  if (callurl == null) {
    foundError('No call information detected. Please go back and make a call.')
  } else {
    var beforeExt = callurl.match(/https:\/\/api\.twilio\.com\/[^.]+/g) // Before the .json part
    if (beforeExt == null) {
      // ERROR
    } else {
      recordingurl = beforeExt[0] + '/Recordings.json'
    }
  }
}

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

confirmationContainer.style.display = 'none'

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
}

// Detect right-to-left languages
function isRTL (s) {
  var ltrChars = 'A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02B8\u0300-\u0590\u0800-\u1FFF' + '\u2C00-\uFB1C\uFDFE-\uFE6F\uFEFD-\uFFFF'
  var rtlChars = '\u0591-\u07FF\uFB1D-\uFDFD\uFE70-\uFEFC'
  var rtlDirCheck = new RegExp('^[^' + ltrChars + ']*[' + rtlChars + ']')

  return rtlDirCheck.test(s)
}

var timePassed = 0
var startTime
var timerRunning = false

function startTimer () {
  startTime = Date.now()
  timerRunning = true
}

function timer () {
  if (timerRunning) {
    timePassed = Date.now() - startTime
    if (timePassed >= 8000) {
      setMetaData('0|Ran out of time')
      completeField()
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
  console.log('About to trigger an HTTP request')
  console.log('Type:', type)
  console.log('URL:', requestUrl)
  console.log('Parameters:', params)
  var request
  var responseText = getMetaData()

  try {
    request = makeHttpObject()

    request.open(type, requestUrl, true)
    request.setRequestHeader('Authorization', 'Basic ' + btoa(unescape(encodeURIComponent(accountSID + ':' + authToken))))
    request.setRequestHeader('Content-type', 'application/x-www-form-urlencoded')

    request.onreadystatechange = function () {
      if (request.readyState === 4) {
        console.log(request)
        responseText = request.responseText

        if (request.status === 0) {
          setMetaData('0|Unable to connect to internet')
          completeField()
        } else if (!responseText) {
          setMetaData('0|No response from Twilio')
          completeField()
        } else {
          setMetaData(responseText)

          console.log('Got response:')
          console.log(responseText)
          runFunction(JSON.parse(responseText), newParams)
        }
      }
    }
    console.log('About to send response')
    request.send(params)
  } catch (error) {
    console.log('Error here: ', error)
    setMetaData('0|' + String(error))
    completeField()
  }
}

function getRecordingInfo (nextFunction) {
  createHttpRequest('GET', recordingurl, undefined, nextFunction)
}

function stopRecordings (requestText) {
  var recordingArray = requestText.recordings
  var numRecordings = recordingArray.length

  console.log('There are', numRecordings, 'recordings')

  for (var r = 0; r < numRecordings; r++) {
    var requestUrl
    var recordingInfo = recordingArray[r]
    var recordingSID = recordingInfo.sid
    var recordingStatus = recordingInfo.status

    if (recordingStatus !== 'completed') { // If not completed, then need to stop the recording
      requestUrl = 'https://api.twilio.com/2010-04-01/Accounts/' + accountSID + '/Calls/' + callSID + '/Recordings/' + recordingSID + '.json'
      createHttpRequest('POST', requestUrl, 'Status=stopped', actionComplete, [r + 1, numRecordings])
    } // End checking recording status
  } // End FOR loop through each recording
}

function deleteRecordings (requestText) {
  var recordingArray = requestText.recordings
  var numRecordings = recordingArray.length

  if (numRecordings === 0) { // If there are no recordings, then nothing to worry about!
    setMetaData('2|No recordings found')
    completeField()
  } else {
    for (var r = 0; r < numRecordings; r++) {
      var requestUrl
      var recordingInfo = recordingArray[r]
      var recordingSID = recordingInfo.sid
      var recordingStatus = recordingInfo.status

      if (recordingStatus === 'completed') {
        requestUrl = 'https://api.twilio.com/2010-04-01/Accounts/' + accountSID + '/Recordings/' + recordingSID + '.json'
        createHttpRequest('DELETE', requestUrl, undefined, actionComplete, [r + 1, numRecordings])
      } else { // If not completed, then need to stop the recording before deleting it
        requestUrl = 'https://api.twilio.com/2010-04-01/Accounts/' + accountSID + '/Calls/' + callSID + '/Recordings/' + recordingSID + '.json'
        createHttpRequest('POST', requestUrl, 'Status=stopped', deleteSingleRecording, [r + 1, numRecordings])
      } // End checking recording status
    } // End FOR loop through each recording
  }
} // End deleteRecordings

function deleteSingleRecording (requestText, recNumbers) {
  if (requestText.status === 'stopped') {
    var recordingSID = requestText.sid
    var requestUrl = 'https://api.twilio.com/2010-04-01/Accounts/' + accountSID + '/Recordings/' + recordingSID + '.json'
    createHttpRequest('DELETE', requestUrl, undefined, deletionComplete, recNumbers)
  } else {
    // ERROR while attempting to stop recording
  }
}

function deletionComplete (requestText, recNumbers) {
  console.log('Deletion complete.')
  console.log(requestText)
  if (recNumbers[0] === recNumbers[1]) { // If on the final recording (e.g. recording 5 of 5), then can set the answer
    checkRecordingStatus()
  }
}

function recordingStarted (requestText) {
  console.log('Start recording complete.')
  console.log(requestText)
  setMetaData('1')
  setAnswer(selectedChoice) // This should hav verification
}

function actionComplete (requestText, recNumbers) {
  if (recNumbers[0] === recNumbers[1]) { // If on the final recording (e.g. recording 5 of 5), then can set the answer
    checkRecordingStatus()
  }
}

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
    setMetaData('0|The following recordings were not deleted: ' + allNotDeleted)
  } else {
    setMetaData('1')
  }

  completeField()
}

function completeField () {
  timerRunning = false
  setAnswer(selectedChoice)
  waitingContainer.innerHTML = 'All set! You can now move to the next field.'
}

// Start other functions

function change () {
  confirmation(this.value)
}

// If the field label or hint contain any HTML that isn't in the form definition, then the < and > characters will have been replaced by their HTML character entities, and the HTML won't render. We need to turn those HTML entities back to actual < and > characters so that the HTML renders properly. This will allow you to render HTML from field references in your field label or hint.
function unEntity (str) {
  return str.replace(/&lt;/g, '<').replace(/&gt;/g, '>')
}
if (fieldProperties.LABEL) {
  document.querySelector('.label').innerHTML = unEntity(fieldProperties.LABEL)
}
if (fieldProperties.HINT) {
  document.querySelector('.hint').innerHTML = unEntity(fieldProperties.HINT)
}

function confirmation (selected) {
  selectedChoice = selected
  confirmationContainer.style.display = 'block'
  if (selectedChoice === '0') {
    confirmationAction.innerHTML = 'not '
  } else {
    confirmationAction.innerHTML = ''
  }

  yesButton.onclick = function () {
    executeAction()
  }

  noButton.onclick = function () {
    clearAnswer()
    confirmationContainer.style.display = 'none'
  }
}

function executeAction () {
  waitingContainer.innerHTML = 'Enumerator, please wait...' // Next: Customize this text
  startTimer()
  if (selectedChoice === '0') {
    if (action === 'delete') {
      console.log('About to delete')
      getRecordingInfo(deleteRecordings)
    } else if (action === 'stop') {
      console.log('About to stop')
      getRecordingInfo(stopRecordings)
    } else {
      setMetaData('2|No action needed to be taken')
      completeField()
    }
  } else if (selectedChoice === '1') {
    if (action === 'start') {
      console.log('About to start')
      var requestUrl = 'https://api.twilio.com//2010-04-01/Accounts/' + accountSID + '/Calls/' + callSID + '/Recordings.json'
      var params = 'RecordingStatusCallbackEvent=in-progress completed absent'
      console.log('About to START a recording')
      createHttpRequest('POST', requestUrl, params, recordingStarted)
    } else {
      setMetaData('2|No action needed to be taken')
      completeField()
    }
  }
}

// If an error was already found, then adds the error message. Otherwise, clears the screen, and displayes the new error.
function foundError (message) {
  if (errorFound) {
    mainContainer.innerHTML += '\n<br>' + message
  } else {
    errorFound = true
    mainContainer.innerHTML = message
  }
}
