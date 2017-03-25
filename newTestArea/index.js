// Display the text upon the given sentence
function display_speech(sth) {
  document.getElementById("display_text").innerHTML = sth;
}

// The speech recognition part
if (annyang) {
  /*
  var commands = {
    'hello': function() {
      //display_speech("123");
    }
  };
  // Add our commands to annyang
  annyang.addCommands(commands);
  */

  // Display the user input
  annyang.addCallback('result', function(userSaid) {

    var userInput = userSaid[0];
    // Show user input
    display_speech(userInput);

    // Synthesis support. Make your web apps talk!
    if ('speechSynthesis' in window) {
      var msg = new SpeechSynthesisUtterance(userInput);
      window.speechSynthesis.speak(msg);
    } else {
      display_speech("Google API not supported");
    }

  });

  // Start listening.
  annyang.start();
}

// Build up a web socket
//var socket = io();