/* global fieldProperties, setAnswer, goToNextField, clearAnswer */

// References to the supported choice containers
var radioButtonsContainer = document.getElementById('radio-buttons-container') // default radio buttons
var selectDropDownContainer = document.getElementById('select-dropdown-container') // minimal appearance

// Detect right-to-left languages
function isRTL (s) {
  var ltrChars = 'A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02B8\u0300-\u0590\u0800-\u1FFF' + '\u2C00-\uFB1C\uFDFE-\uFE6F\uFEFD-\uFFFF'
  var rtlChars = '\u0591-\u07FF\uFB1D-\uFDFD\uFE70-\uFEFC'
  var rtlDirCheck = new RegExp('^[^' + ltrChars + ']*[' + rtlChars + ']')

  return rtlDirCheck.test(s)
}

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

// Save the user's response (update the current answer)

function change () {
  setAnswer(this.value)
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