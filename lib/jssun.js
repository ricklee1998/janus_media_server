const janusURL = 'ws://106.240.247.43:9501';
var ws = new WebSocket(janusURL, 'janus-protocol');
const janus = {};

//const userBtns = document.getElementsByClassName("userBtn");
const userBtn1 = document.getElementById("userBtn1");
const userBtn2 = document.getElementById("userBtn2");
const userBtn3 = document.getElementById("userBtn3");
const printBox = document.getElementById("printBox");
const videoBox = document.getElementById("videoBox");
const videoFlag = document.getElementById("videoFlag");
const subscribeFlag = document.getElementById("subscribeFlag");
//피어 설정
var session_id;
var publish_id;
var subscriber_ids = {};
var subscriberTransaction = {};
var subscriberFeedId = {};
var feedIdToId = {};
var op;

let janusStreams = {};
let janusStreamPeers = {};
let userId;
let people = {};

//cam설정 화면 제한
let cam_2 = [960, 540, 1382000, 15];
let cam_4 = [640, 360, 230000, 12];
let mediaConstraint ={
    video:{
        width:{min: cam_2[0], ideal: cam_2[0]},
		height:{min: cam_2[1], ideal: cam_2[1]},
		frameRate: {
			ideal: cam_2[3],
			max: cam_2[3]
		}
	},
	audio: true,
};
let bitrate = cam_2[2];

/////////////////////////////////////////////////////////
//ws 웹소켓
ws.onopen = () => {
	socketLog("info", `WebSocket ${janusURL} has connected!`);
    console.log(`WebSocket ${janusURL} has connected!`);
    userBtn1.disabled = false;
    userBtn2.disabled = false;
    userBtn3.disabled = false;
}
ws.onerror = error => {
	console.log(`WebSocket error : `,error);
}
ws.onmessage = e => {
	getMsg(e.data);
}
ws.onclose = () => {
	console.log(`WebSocket has closed `);
}
/////////////////////////////////////////////////////////
//transaction 값 생성
const getTrxID = () => {
	var charSet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	var randomString = '';
	for(var i=0;i<12;i++){
		var randomPoz = Math.floor(Math.random()*charSet.length);
		randomString += charSet.substring(randomPoz, randomPoz+1);
	}
	return randomString;
}
/////////////////////////////////////////////////////////
//printbox 로그출력
const socketLog = (type, contents) => {
	let contentsJson = JSON.stringify(contents);
	let textLine = document.createElement("p");
	let textContents = document.createTextNode(`[${type}] ${contentsJson}`);
    textLine.appendChild(textContents);
    console.log("텍스트출력:"+type)
    if(type=="info"){
        textLine.style.color = "green";
    }else if(type=="send"){
        textLine.style.color = "red";
    }else if(type=="receive"){
        textLine.style.color = "blue";
    }else{
        textLine.style.color = "cyan";
    }
    
	printBox.prepend(textLine)
}
/////////////////////////////////////////////////////////
//button click
userBtn1.addEventListener('click', () => {
    userId = userBtn1.value;
    janus.createSession(ws);
    userBtn1.disabled = true;
    userBtn2.disabled = true;
    userBtn3.disabled = true;
});
userBtn2.addEventListener('click', () => {
    userId = userBtn2.value;
    janus.createSession(ws);
    userBtn1.disabled = true;
    userBtn2.disabled = true;
    userBtn3.disabled = true;
});
userBtn3.addEventListener('click', () =>{
    userId = userBtn3.value;
    janus.createSession(ws);
    userBtn1.disabled = true;
    userBtn2.disabled = true;
    userBtn3.disabled = true;
});
/////////////////////////////////////////////////////////
//receive Data OP
const getMsg = (msg) => {
    let msgObj = JSON.parse(msg);
    //keep alive
    if(msgObj.janus !== 'ack'){
        socketLog('receive', JSON.parse(msg));
    }
    switch(msgObj.janus){
        case 'success':
            switch(op){
                case 'create':
                    session_id = msgObj.data.id;
                    janus.attachPlugin(ws, userId, session_id, 'janus.plugin.videoroom',true);
                    break;
                case 'attachPublisher':
                    console.log("msgObj:"+msgObj.janus)
                    console.log("msgObj:"+msgObj.transaction)
                    console.log("msgObj:"+msgObj.data)
                    publish_id = msgObj.data.id;
					if(userId === 'user1'){
						janus.destroyRoom(ws);
					} else {
						janus.joinVideoRoom(ws,"19980124")
					}
                    break;
                case 'attachSubscriber':
                    let tempId = subscriberTransaction[msgObj.transaction];
                    subscriber_ids[tempId] = msgObj.data.id;
                    setTimeout(()=>{
                        janus.joinSubscriber(ws, "19980124", tempId, subscriberFeedId[tempId]);
                    }, 3000);
                    break;
                case 'createVideoRoom':
                    janus.joinVideoRoom(ws,"19980124")
                    break;
                case 'joinVideoRoom':
                    break;
                case 'createOffer':
                    break;
                case 'destroyVideoRoom':
                    console.log("데리룸받음");
                    janus.createVideoRoom(ws)
                    break;
                default:
                    break;
            }
            break;
        case 'event':
        {
            //joinvideo room joined
            if(msgObj.plugindata.data.videoroom == 'joined'){
				let publishers = msgObj.plugindata.data.publishers;

				publishers.forEach(element => {
					subscriberFeedId[element.display] = element.id;
					feedIdToId[element.id] = element.display;
					if(subscribeFlag.checked){
						janus.attachPlugin(ws,element.display,session_id,'janus.plugin.videoroom', false);
					} else {
						plusOne2(element.id);
					}
				})
				createVideoBox(userId);
				createSDPOffer(userId);
			}
			if(msgObj.plugindata.data.configured == 'ok'){
				if(msgObj.jsep)
					janusStreamPeers[userId].setRemoteDescription(msgObj.jsep);
			}
			if(msgObj.jsep && msgObj.jsep.type === 'offer'){
				createVideoBox(msgObj.plugindata.data.display);
				createSDPAnswer(msgObj);
			}
			if(msgObj.plugindata.data.videoroom != 'joined' && msgObj.plugindata.data.publishers && msgObj.plugindata.data.publishers.length > 0){
				subscriberFeedId[msgObj.plugindata.data.publishers[0].display] = msgObj.plugindata.data.publishers[0].id;
				feedIdToId[msgObj.plugindata.data.publishers[0].id] = msgObj.plugindata.data.publishers[0].display;

				if(subscribeFlag.checked){
					janus.attachPlugin(ws, msgObj.plugindata.data.publishers[0].display, session_id, 'janus.plugin.videoroom', false );
				} else {
					plusOne2(msgObj.plugindata.data.publishers[0].id);
				}
			}
			
            break;
        }
        default:
            break;
    }
}
/////////////////////////////////////////////////////////
//send Data OP
janus.createSession = ws => {
    // [receive] {"janus":"success","transaction":"V0sOyQrYVZ1N","data":{"id":515042623976119}}
    // [send] {"janus":"create","transaction":"V0sOyQrYVZ1N"}
    let trxid = getTrxID();
	op = 'create';
	let msg = {
		janus: op,
		transaction: trxid
    };
    socketLog('send', msg);
    ws.send(JSON.stringify(msg));
    return trxid;
}
janus.destroySession = (ws, session_id) => {
	let trxid = getTrxID();
	op = 'destroy';
	let msg = {
		janus: op,
		transaction: trxid,
		session_id: session_id
	}

	ws.send(JSON.stringify(msg));

	return trxid;
}
janus.attachPlugin = (ws, userNickName, session_id, plugin_name, isPublisher) => {
    // [receive] {"janus":"success","session_id":7907193649270930,"transaction":"uX5HR9UYQ1d8","data":{"id":118160198284110}}
    // [send] {"janus":"attach","transaction":"uX5HR9UYQ1d8","opaqueId":"user1","session_id":7907193649270930,"plugin":"janus.plugin.videoroom"}
	let trxid = getTrxID();
	if(isPublisher){
		op = 'attachPublisher';
	} else {
		op = 'attachSubscriber';
		subscriberTransaction[trxid] = userNickName;
	}
	let msg = {
		janus: 'attach',
		transaction: trxid,
		opaqueId: userNickName,
		session_id : session_id,
		plugin : plugin_name
	};

	socketLog('send', msg);
	ws.send(JSON.stringify(msg));

	return trxid;
}

janus.createVideoRoom = (ws) => {
    //[receive] {"janus":"success","session_id":3312660165882751,"transaction":"MNAG51YB1QnX","sender":2115027813358410,"plugindata":{"plugin":"janus.plugin.videoroom","data":{"videoroom":"created","room":"19980124","permanent":false}}}
    //[send] {"janus":"message","session_id":3312660165882751,"handle_id":2115027813358410,"transaction":"MNAG51YB1QnX","body":{"request":"create","room":"19980124","publishers":100,"audiolevel_event":false,"audio_level_average":70,"record":false,"rec_dir":"/opt/justin/share/janus/recordings/"}}
    console.log("크리룸");
	let trxid = getTrxID();
	op = 'createVideoRoom'
	let msg = {
		janus: 'message',
		session_id: session_id,
		handle_id: publish_id,
		transaction: trxid,
		body : {
			request: 'create',
			room: "19980124",
			publishers: 100,
			audiolevel_event: false,
			audio_level_average: 70,
			record: false,
			rec_dir: '/opt/justin/share/janus/recordings/'
		}
	};

	socketLog('send', msg);
	ws.send(JSON.stringify(msg));

	return trxid;
}
janus.destroyRoom = (ws) => {
    // [receive] {"janus":"success","session_id":4235116192647646,"transaction":"t5JQwnGAiYC2","sender":4626551672571911,"plugindata":{"plugin":"janus.plugin.videoroom","data":{"videoroom":"destroyed","room":"19980124","permanent":false}}}
    // [send] {"janus":"message","session_id":4235116192647646,"handle_id":4626551672571911,"transaction":"t5JQwnGAiYC2","body":{"request":"destroy","room":"19980124"}}
    console.log("데리룸");
    let trxid = getTrxID();
	op = 'destroyVideoRoom'
	let msg = {
		janus: 'message',
		session_id: session_id,
		handle_id: publish_id,
		transaction: trxid,
		body : {
			request: 'destroy',
			room: "19980124"
		}
	};

	socketLog('send', msg);
	ws.send(JSON.stringify(msg));
}
janus.joinVideoRoom = (ws, roomId) => {
    //[receive] {"janus":"event","session_id":9002735655176441,"transaction":"VddAkEeE1Xyh","sender":4165890073971644,"plugindata":{"plugin":"janus.plugin.videoroom","data":{"videoroom":"joined","room":"19980124","description":"Room 19980124","id":"e2a7aa8f-6964-4210-8729-45b4c2eb0e00","private_id":3334407530,"publishers":[]}}}
    //[send] {"janus":"message","session_id":9002735655176441,"handle_id":4165890073971644,"transaction":"VddAkEeE1Xyh","body":{"request":"join","ptype":"publisher","room":"19980124","display":"test"}}
	let trxid = getTrxID();
	op = 'joinVideoRoom';
	let msg = {
		janus: 'message',
		session_id: session_id,
		handle_id: publish_id,
		transaction: trxid,
		body: {
			request: 'join',
			ptype: 'publisher',
			room: roomId,
			display: "test"
		}
	}

	socketLog('send', msg);
	ws.send(JSON.stringify(msg));
}

janus.createOffer = (ws,sdp) => {
	let trxid = getTrxID();
	let msg = {
		janus: 'message',
		transaction: trxid,
		handle_id: publish_id,
		session_id: session_id,
		body:{
			request: 'publish',
			video: true,
			audio: true,
			display: userId,
			// bitrate
		},
		jsep: {
			type: sdp.type,
			sdp: sdp.sdp
		}
	}

	socketLog('send', msg);
	ws.send(JSON.stringify(msg));
}
janus.joinSubscriber = (ws, roomId, displayId, feedId) => {
	let trxid = getTrxID();
	order = 'joinVideoRoom';
	let msg = {
		janus: "message",
		session_id: session_id,
		handle_id: subscriber_ids[displayId],
		transaction: trxid,
		body: {
			request: "join",
			ptype: "subscriber",
			room: roomId,
			display: "test",
			close_pc: false,
			feed: feedId
		}
	};

	socketLog('send', msg);
	ws.send(JSON.stringify(msg));
}
/////////////////////////////////////////////////////////
const plusOne = (id) => {
	people[id] = true;
	let nop = Object.keys(people).length;
	if(nop == 2){
		
		document.getElementById('videoBox').style.gridTemplateColumns = "repeat(auto-fill, minmax(50%, auto))";
	}
}
const plusOne2 = (id) => {
	people[id] = true;
	let nop = Object.keys(people).length;
	if(nop <= 2){
		document.getElementById('videoBox').style.gridTemplateColumns = "repeat(auto-fill, minmax(50%, auto))";
	} 
}
const minusOne = (id) => {
    let nop = Object.keys(people).length;
};
/////////////////////////////////////////////////////////
const createVideoBox = userId => {
	let videoContainner = document.createElement("div");
	videoContainner.classList = "multi-video";
	videoContainner.id = userId;

	let videoLabel = document.createElement("p");
	let videoLabelText = document.createTextNode(userId);
	videoLabel.appendChild(videoLabelText);

	videoContainner.appendChild(videoLabel);

	let multiVideo = document.createElement("video");
	multiVideo.autoplay = true;
	multiVideo.id = "multiVideo-" + userId;
	videoContainner.appendChild(multiVideo);
	videoBox.appendChild(videoContainner);
	plusOne(userId);

}

const createSDPOffer = async userId => {
	janusStreams[userId] = await navigator.mediaDevices.getUserMedia(mediaConstraint);

	if(videoFlag.checked){
		let str = 'multiVideo-'+userId;
		let multiVideo = document.getElementById(str);
		multiVideo.srcObject = janusStreams[userId];
		multiVideo.muted = true
	}
	janusStreamPeers[userId] = new RTCPeerConnection();
	janusStreams[userId].getTracks().forEach(track => {
		janusStreamPeers[userId].addTrack(track, janusStreams[userId]);
	});

	janusStreamPeers[userId].createOffer().then(sdp => {
		janusStreamPeers[userId].setLocalDescription(sdp);
		return sdp;
	}).then(sdp => {
		janus.createOffer(ws,sdp);
	})


}

const createSDPAnswer = async data => {
	let tempId = data.plugindata.data.display;
	janusStreamPeers[tempId] = new RTCPeerConnection();
	janusStreamPeers[tempId].ontrack = e => {
		janusStreams[tempId] = e.streams[0];

		if(videoFlag.checked){
			let multiVideo = document.querySelector("#multiVideo-" + tempId);
			multiVideo.srcObject = janusStreams[tempId];
		}
	}

	await janusStreamPeers[tempId].setRemoteDescription(data.jsep);
	let answerSdp = await janusStreamPeers[tempId].createAnswer();
	await janusStreamPeers[tempId].setLocalDescription(answerSdp);

	janusStreamPeers[tempId].onicecandidate = e => {
		if(!e.candidate){
			let trxid = getTrxID();
			let msg = {
				janus: "message",
				transaction: trxid,
				handle_id: subscriber_ids[tempId],
				session_id: session_id,
				body: {
					request: "start",
					room: "19980124",
					video: true,
					audio: true,
				},
				jsep: janusStreamPeers[tempId].localDescription
			};

			socketLog("send", msg);
			ws.send(JSON.stringify(msg));
		}
	}
}
