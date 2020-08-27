# twilio-control

Your choice list should have two choice values: One with a value of `1`, and one with a value of `0`. The choice with a value of `1` is if consent was given, and `0` should be if consent was denied.

## Parameters
|Name|Description|Default|
|:---|:---|:---|
|`action`|What happens when a choice is selected. See [Actions](#actions) below for a list of values you can use.|`delete`|
|||

### Actions

These are the values you can give to the parameter `action`. In this table, 'value' is the value you give to the `action` parameter, and 'Trigger' is the selected choice value that triggers the action. For examample, if the `action` parameter has a value of 'delete', then nothing will happen if the choice selected has a value of `1`, only if the choice selected has a value of `0`.


|Value|Trigger|Description|
|:---|:---|:---|
|`'delete'`|`0`|If consent is denied, then the recording is stopped, and then deleted.|
|`'stop'`|`0`|If consent is denied, then the recording is stopped, but not deleted. That way, you have a recording of the respondent denying consent.|
|`'start'`|`1`|If consent is approved, then the call recording starts.
