var isConnectToDemoAgent = true; 

// Page Loaded
$(function() {
  $('#serverToggle').change(function() {
    isConnectToDemoAgent = this.checked;
    if(isConnectToDemoAgent){
      document.title = "Demo Agent";
    } else {
      document.title = "Server Test";
    }
    console.log("Agent Switched: Connect to DemoAgent? " + isConnectToDemoAgent);
  });


  $('#userTextButton').click(function(){
    // Get userInput from form userText
    var userInput = $('#userText').val();
    sendAndWaitToOutputAPIAI(userInput);
  });

  // Allow ENTER-key press to trigger text enter
  $("#userText").keyup(function(e){
    if(e.keyCode === 13){
      e.preventDefault();
      $('#userTextButton').click()
    }
  });

});


// Display the user input and send it to api.ai and then
// Waiting on the response to produce voice output
function sendAndWaitToOutputAPIAI(userInputToSend){
  // Show user input
  display_speech(userInputToSend);
  // Notify the server to send api.ai this input
  socket.emit("send_to_apiai", [userInputToSend, isConnectToDemoAgent]);
  sysCanOutput = true;
  // Wait for the response from the server along with the response from api.ai
  socket.on("response_from_apiai", function(response){
    console.log("response_from_apiai: " + response);
    // Speak out the response
    produce_voice_output(response);
  });
}


// Stop the synthesisor from speaking without user initiative
var sysCanOutput = false;

// Create the socket for communication
var socket = io();

// Display the text upon the given sentence
function display_speech(msg) {
  document.getElementById("display_text").innerHTML = msg;
}

// Produce voice output
// Synthesis support. Make your web apps talk!
function produce_voice_output(text) {
  if(sysCanOutput){
    // Wait for next user speech initiative
    sysCanOutput = false;
    // Check whether the browser support the synthesisor
    if ('speechSynthesis' in window) {
      var sysOutput = new SpeechSynthesisUtterance(text);
      window.speechSynthesis.speak(sysOutput);
      display_speech(text);
    } else {
      display_speech("Google API not supported");
    }
  }
}


// The speech recognition part
if (annyang) {

  // Tell KITT to use annyang
  SpeechKITT.annyang();
  // Define a stylesheet for KITT to use
  SpeechKITT.setStylesheet('//cdnjs.cloudflare.com/ajax/libs/SpeechKITT/0.3.0/themes/flat.css');
  // Render KITT's interface
  SpeechKITT.vroom();


  // Notify the server that speech recognition is ready
  socket.emit("annyang", "Speech Recognition is ready");

  // Display the user input
  annyang.addCallback('result', function(userSaid) {
    // Catch the highest possible input from user
    var userInput = userSaid[0];
    sendAndWaitToOutputAPIAI(userInput);
  });

  // Start listening
  annyang.start();

} else {
  socket.emit("annyang", "Speech Recognition is closed");
}