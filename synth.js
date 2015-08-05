
$(function () {
var keyboard = new QwertyHancock({
                 id: 'keyboard',
                 width: 600,
                 height: 150,
                 octaves: 2,
                 startNote: 'A3',
                 whiteNotesColour: 'white',
                 blackNotesColour: 'black',
                 hoverColour: '#f3e939',
                 keyboardLayout: 'en'
            });

  keyboard.keyDown = function (note, frequency) {
    jQuery.event.trigger('frequency', [frequency] );
    jQuery.event.trigger('gateOn');
  };

  keyboard.keyUp(function (_, _) { });

  $("#attack").knob({
    'release' : function (v) { jQuery.event.trigger('setAttack', v / 100); }
  });

  $("#release").knob({
    'release' : function (v) { jQuery.event.trigger('setRelease', v / 100); }
  });

  var context = new AudioContext();
  var recorderNode = context.createGain();
  recorderNode.gain.value = 1;
  recorderNode.connect(context.destination);
  window.context = context;
  var filter = context.createBiquadFilter();
  filter.type = 0;
  filter.frequency.value = 5000;

  var VCO = (function(context) {
    function VCO(){
      this.oscillator = context.createOscillator();
      this.oscillator.type = this.oscillator.SAWTOOTH;
      this.setFrequency(440);
      this.oscillator.start(0);

      this.input = this.oscillator;
      this.output = this.oscillator;

      var that = this;
      $(document).bind('frequency', function (_, frequency) {
        that.setFrequency(frequency);
      });
    };

    VCO.prototype.setFrequency = function(frequency) {
      this.oscillator.frequency.setValueAtTime(frequency, context.currentTime);
    };

    VCO.prototype.connect = function(node) {
      if (node.hasOwnProperty('input')) {
        this.output.connect(node.input);
      } else {
        this.output.connect(node);
      };
    }

    return VCO;
  })(context);

  var VCA = (function(context) {
    function VCA() {
      this.gain = context.createGain();
      this.gain.gain.value = 0;
      this.input = this.gain;
      this.output = this.gain;
      this.amplitude = this.gain.gain;
    };

    VCA.prototype.connect = function(node) {
      if (node.hasOwnProperty('input')) {
        this.output.connect(node.input);
      } else {
        this.output.connect(node);
      };
    }

    VCA.prototype.disconnect = function(long) {
      this.output.disconnect(long);
    }

    return VCA;
  })(context);

  var EnvelopeGenerator = (function(context) {
    function EnvelopeGenerator() {
      this.attackTime = 0.1;
      this.releaseTime = 0.1;

      var that = this;
      $(document).bind('gateOn', function (_) {
        that.trigger();
      });
      $(document).bind('setAttack', function (_, value) {
        that.attackTime = value;
      });
      $(document).bind('setRelease', function (_, value) {
        that.releaseTime = value;
      });
    };

    EnvelopeGenerator.prototype.trigger = function() {
      now = context.currentTime;
      this.param.cancelScheduledValues(now);
      this.param.setValueAtTime(0, now);
      this.param.linearRampToValueAtTime(1, now + this.attackTime);
      this.param.linearRampToValueAtTime(0, now + this.attackTime + this.releaseTime);
    };

    EnvelopeGenerator.prototype.connect = function(param) {
      this.param = param;
    };

    return EnvelopeGenerator;
  })(context);

  var vco = new VCO;
  var vca = new VCA;
  var envelope = new EnvelopeGenerator;
  var filterOn = false;
  var delayOn = false;

  vco.connect(vca);
  envelope.connect(vca.amplitude);
  vca.connect(filter);
  filter.connect(recorderNode);

  changeFrequency = function(element) {
  // Clamp the frequency between the minimum value (40 Hz) and half of the
  // sampling rate.
  var minValue = 40;
  var maxValue = context.sampleRate / 2;
  // Logarithm (base 2) to compute how many octaves fall in the range.
  var numberOfOctaves = Math.log(maxValue / minValue) / Math.LN2;
  // Compute a multiplier from 0 to 1 based on an exponential scale.
  var multiplier = Math.pow(2, numberOfOctaves * (element.value - 1.0));
  // Get back to the frequency value between min and max.
  filter.frequency.value = maxValue * multiplier;
  };

  changeQuality = function(element) {
  filter.Q.value = element.value * 30;
  };

  changeGain = function(element) {
  filter.gain.value = element.value * 10;
  };

  toggleFilter = function(element) {
    vca.disconnect(0);
    filter.disconnect(0); 
    // Check if delay is on.
    if(!delayOn) { 
	  // Check if we want to enable the filter.
	  if (element.checked) {
	    // Connect through the filter.
	    vca.connect(filter);
	    filter.connect(recorderNode);
	    filterOn = true;
	  } else {
	    // Otherwise, connect directly.
	    vca.connect(recorderNode);
	    filterOn = false;
	  }
    }
    else {
	    if (element.checked) {
	    vca.connect(filter);
	    filter.connect(delayNode.input);
	    filterOn = true;
	  } else {
	    vca.connect(delayNode.input);
	    filterOn = false;
	  }
    }
};

  changeFilter = function(type) {
	switch(type) {
		case "0": 
			filter.type = "lowpass";
			break;
		case "1": 
			filter.type = "highpass";
			console.log(filter.type);
			break;
		case "2": 
			filter.type = "bandpass";
			break;
		case "3": 
			filter.type = "lowshelf";
			break;
		case "4": 
			filter.type = "highshelf";
			break;
		case "5": 
			filter.type = "peaking";
			break;
		case "6": 
			filter.type = "notch";
			break;
		case "7": 
			filter.type = "allpass";
			break;
	}
};

    navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
    window.recorder = new Recorder(recorderNode);

    navigator.getUserMedia({audio:true, video: false}, function(stream) {
	var input = context.createMediaStreamSource(stream);
	window.horribleHackForMozilla = input;
	input.connect(filter);
	}, function(e) {
		console.log("Media error:" + e);
	});

  toggleDelay = function(element) {
	if (!filterOn) {
		vca.disconnect(0);
		delayNode.disconnect(0);
		if(element.checked) {
			vca.connect(delayNode.input);
			delayNode.connect(recorderNode);
			delayOn = true;
		}
		else {
			vca.connect(recorderNode);
			delayOn = false;
		}
	}
	if (filterOn) {
		filter.disconnect(0);
		delayNode.disconnect(0);
		if(element.checked) {
			filter.connect(delayNode.input);
			delayNode.connect(recorderNode);
			delayOn = true;
		}
		else {
			filter.connect(recorderNode);
		}
	}
}

var SlapbackDelayNode = function(){
    //create the nodes we’ll use
    this.input = context.createGain();
    var output = context.createGain(),
    delay = context.createDelay(),
    feedback = context.createGain(),
    wetLevel = context.createGain();

    //set some decent values
    delay.delayTime.value = 0.15; //150 ms delay
    feedback.gain.value = 0.25;
    wetLevel.gain.value = 0.25;

    //set up the routing
    this.input.connect(delay);
    this.input.connect(output);
    delay.connect(feedback);
    delay.connect(wetLevel);
    feedback.connect(delay);
    wetLevel.connect(output);
	    
    SlapbackDelayNode.prototype.connect = function(target){
       output.connect(target);
    };
    SlapbackDelayNode.prototype.disconnect = function(channel) {
	output.disconnect(channel);
    }
};

  var delayNode = new SlapbackDelayNode();

  
        //---------------
        // Compatibility
        //---------------
        /*(function() {
            var start = 'start',
                stop = 'stop',
                buffer = context.createBufferSource();

            if (typeof buffer.start !== 'function') {
                start = 'noteOn';
            }
            audio.compatibility.start = start;

            if (typeof buffer.stop !== 'function') {
                stop = 'noteOff';
            }
            audio.compatibility.stop = stop;
        })();
*/
});
