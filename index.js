var express = require('express');
var exphbs = require('express-handlebars');
const formidable = require('express-formidable');
const bodyParser = require('body-parser');
var stripe = require('stripe')(process.env.STRIPE);
var admin = require("firebase-admin");

function tax(sal) {
	if (sal < 12) {
		return 0;
	} else if (sal < 18) {
		return (sal * 6) * 1;
	} else if (sal < 30) {
		return (sal * 6) * 2;
	} else {
		return (sal * 6) * 3;
	}
}

var serviceAccount = {
	type: "service_account",
	project_id: "cityofsamuelville",
	private_key_id: process.env.PRIVATE_KEY_ID,
	private_key: process.env.PRIVATE_KEY.replace(/\\n/g, '\n'),
	client_email: "firebase-adminsdk-b921k@cityofsamuelville.iam.gserviceaccount.com",
	client_id: "118410917158294774601",
	auth_uri: "https://accounts.google.com/o/oauth2/auth",
	token_uri: "https://oauth2.googleapis.com/token",
	auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
	client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-b921k%40cityofsamuelville.iam.gserviceaccount.com"
};

admin.initializeApp({
	credential: admin.credential.cert(serviceAccount),
	databaseURL: "https://cityofsamuelville.firebaseio.com"
});

var db = admin.firestore();
var app = express();
app.engine('handlebars', exphbs());
app.set('view engine', 'handlebars');
app.use(express.static('static'));
app.use(formidable());
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/', function(req, res) {
	if (req.get('X-Replit-User-Id')) {
		db.collection(req.get('X-Replit-User-Id')).doc('status').get()
			.then(function(doc) {
				if (!doc.exists) {
					res.render('apply', {
						id: req.get('X-Replit-User-Id'),
						name: req.get('X-Replit-User-Name')
					});
				} else {
					res.render('portal', {
						id: req.get('X-Replit-User-Id'),
						name: req.get('X-Replit-User-Name')
					});
				}
			});
	} else {
		res.render('login');
	}
});

app.get('/apply', function(req, res) {
	res.status(405).render('405');
});

app.post('/apply', function(req, res) {
	if (req.fields.crime == "fel" || req.fields.crime == "fare") {
		res.render('rejected', {
			name: req.get('X-Replit-User-Name'),
			reason: "Commited felony crime or fare evasion/tomato theft."
		});
	}
	else if (req.fields.kids == 0) {
		res.render('rejected', {
			name: req.get('X-Replit-User-Name'),
			reason: "At current capacity, SamuelVille cannot accept applicants without children."
		});
	}
	else {
		db.collection(req.get('X-Replit-User-Id')).doc('status').set({
			legalname: {
				f: req.fields.first,
				m: req.fields.middle,
				l: req.fields.last
			},
			address: req.fields.address,
			kids: req.fields.kids,
			bank: {
				bal: 10
			}
		}).then(function() {
			res.render('onboard', {
				name: req.get('X-Replit-User-Name'),
				id: req.get('X-Replit-User-Id')
			});
		});
	}
});

app.get('/castvote', function(req, res) {
	db.collection(req.get('X-Replit-User-Id')).doc('vote').set(req.query, {
		merge: true
	}).then(function() {
		res.render('votedone', req.query);
	});
});

app.get('/paytaxes', function(req, res) {
	stripe.paymentIntents.create({
		amount: tax(parseInt(req.query.sal, 10) + "00"),
		currency: 'usd',
		metadata: { integration_check: 'accept_a_payment' },
	}).then(function(intent) {
		res.render('taxpay', {
			client_secret: intent.client_secret,
			id: req.get('X-Replit-User-Id')
		});
	}).catch(function(err) {
		console.error(err);
	});
});


app.get('/coffee', function(req, res) {
	res.status(418).render('418');
});
app.get('/*.json', function(req, res) {
	res.status(404).json({
		error: "Page not found. See /api for docs."
	});
});
app.use(function(req, res) {
	res.render('404');
});
app.use(function(error, req, res, next) {
	require('fs').appendFile('log.txt', '\nERR 500: ' + error + " - " + new Date().toString() + "\n\n", function(err) {
		if (err) {
			res.status(500).render('500', {
				error: error,
				logged: false
			});
		} else {
			res.status(500).render('500', {
				error: error,
				logged: true
			});
		}
	});
});
app.listen(3000);