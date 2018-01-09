var path = require("path")

var dbConfig = require("./config.js")

const express = require("express");
var app = express();
const router = express.Router();
const bodyParser = require("body-parser")
const engine = require("consolidate");
const MongoClient = require("mongodb").MongoClient
var ObjectId = require('mongodb').ObjectID;
var nodemailer = require("nodemailer");
var _ = require("lodash")
var Q = require("q")
var jwt = require("./jwt.js")
var transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "serverppw@gmail.com",
    pass: "serverppw22121992"

  }

});

app.use(function(req, res, next) {
  const t = jwt.verifica(req)
  if (/^\/admin\/(.*)/.test(req.url) && t != true) {
    res.send({
      errore: t
    })
    return false
  }
  next()
})

app.use(router)

const parserBody = bodyParser.urlencoded({
  extended: false
})
const parserBodyJSON = bodyParser.json()

app.engine("html", engine.mustache)
app.set("view engine", "html")

router.get("/prova/:id([0-9]+)", function(req, res) {
  res.send({
    id: req.params.id
  })
})


router.get("/admin/prodotti", function(req, res) {


  const db = req.app.locals.db

  db.collection("prodotti").find().toArray(function(e, r) {
    res.send(r)
  })


})

router.get("/admin/ordini", function(req, res) {


  const db = req.app.locals.db

  db.collection("ordini").find().toArray(function(e, r) {
    res.send(r)
  })

})


router.get("/index/prodotti", function(req, res) {


  const db = req.app.locals.db

  db.collection("prodotti").find().toArray(function(e, r) {
    res.send(r)
  })


})


router.get("/index/prodotto/:id([a-zA-Z0-9\?]+)", function(req, res) {

  const db = req.app.locals.db

  db.collection("prodotti").find({
    _id: ObjectId(req.params.id)
  }).toArray(function(e, r) {

    var options = "<option selected disabled>-- Seleziona la quantita di prodotto --</option>"
    for (var i = 0; i < r[0].quantita; i++) {
      options += "<option value='" + (i + 1) + "'>" + (i + 1) + "</option>"
    }

    const select_quantita = "<select id=\"quantita_prodotto\">" + options + "</select><br /><br />"

    res.render(path.join(__dirname, "../layout_e-commerce/product.html"), {
      param: r[0],
      div_quantita: (r[0].quantita <= 0) ? '<span class="badge badge-danger" id="nonDisponibile">NON Disponibile</span>' : '<span class="badge badge-success" id="disponibile">Disponibile (' + r[0].quantita + ')</span><br /><br />' + select_quantita,
      bottone_acquista: (r[0].quantita <= 0) ? '' : '<button class="btn btn-lg btn-primary" id="aggiungi_al_carrello">Aggiungi al Carrello</button>'

    })
  })
})






router.post("/admin/prodotti/nuovo", parserBodyJSON, function(req, res) {

  const db = req.app.locals.db


db.collection("newsletter").find().toArray(function(e, i) {
        _.map(i, function(r) {
          transporter.sendMail({
            from: "serverppw@gmail.com",
            to: r.mail,
            subject: "Nuovo prodotto in vendita",
            text: "Vieni a vedere il nuovo prodotto aggiunto al catalogo eCommerce ;)"
          }, function(error, info) {
            if (error) {
              console.log(error);
            } else {
              console.log("Notifica nuovo prodotto, email inviata a", r.mail);
            }
          });
        })
      })

  db.collection("prodotti").insert({
    nome: req.body.nome,
    descrizione: req.body.descrizione,
    immagine: req.body.immagine,
    quantita: parseInt(req.body.quantita),
    prezzo: req.body.prezzo,
    sconto: req.body.sconto
  }, function(err, doc) {
    if (err) {
      res.send({
        inserito: false
      })
    } else {
      res.send({
        inserito: true
      })
    }
  })

})



router.post("/checkout", parserBodyJSON, function(req, res) {

  const db = req.app.locals.db

            transporter.sendMail({
            from: "serverppw@gmail.com",
            to: "112ivan112@gmail.com",
            subject: "Nuovo ordine",
            text: "e' stato effettuato un nuovo ordine."
          }, function(error, info) {
            if (error) {
              console.log(error);
            } else {
              console.log("Notifica nuovo ordine, email inviata a: 112ivan112@gmail.com");
            }
          });


  //vedo la quantita di oggetto acquistata e la scalo.
  _.map(req.body.prodotti, function(v) {

    db.collection("prodotti").update({
      nome: v.nome
    }, {
      $inc: {
        quantita: -v.quantita,
      }
    }, function(e, r) {
      console.log(e)
    })

  })

  const n = db.collection("prodotti").find({
    quantita: {
      $lte: 1
    }
  }).toArray(function(e, c) {

    console.log("documenti", c)

    _.map(c, function(v) {
      transporter.sendMail({
        from: "serverppw@gmail.com",
        to: "112ivan112@gmail.com",
        subject: "Un prodotto sta per terminare",
        text: "Il prodotto " + v.nome + " sta per terminare\n"
      }, function(error, info) {
        if (error) {
          console.log(error);
        } else {
          console.log("Notifica su admin (prodotto sta per terminare)");
        }
      });
    })
  })

  db.collection("ordini").insert({
    nome: req.body.nome,
    cognome: req.body.cognome,
    mail: req.body.mail,
    telefono: req.body.telefono,
    indirizzo: req.body.indirizzo,
    pagamento: req.body.pagamento,
    prodotti: req.body.prodotti

  }, function(err, doc) {
    if (err) {
      res.send({
        inserito: false
      })
    } else {
      res.send({
        inserito: true
      })
    }
  })

})


// --> [0] 

router.post("/admin/prodotti/edit", parserBodyJSON, function(req, res) {

  const db = req.app.locals.db

  // verifica eventuali newsletter (notifica prezzo e/o quantità)

  const z = db.collection("prodotti").find({
    _id: ObjectId(req.body._id)
  }).toArray();

  z.then(function(v) {

    if (v[0].length <= 0) {
      res.send("Errore, il prodotto non esiste")
      return false
    }

    if (req.body.prezzo != v[0].prezzo) {
      db.collection("notificaSuPrezzo").find({
        idOggetto: ObjectId(req.body._id)
      }).toArray(function(e, i) {
        _.map(i, function(r) {
          transporter.sendMail({
            from: "serverppw@gmail.com",
            to: r.mail,
            subject: "Il prodotto che stavi osservando è cambiato di prezzo",
            text: "Il prodotto " + v[0].nome + " che stavi osservando è cambiato di prezzo\n" + " non costa più " + v[0].prezzo + "€ ma " + req.body.prezzo + "€"
          }, function(error, info) {
            if (error) {
              console.log(error);
            } else {
              console.log("Notifica su prezzo, email inviata a", r.mail);
            }
          });
        })
      })

    }

    if (req.body.sconto != v[0].sconto) {
      db.collection("notificaSuPrezzo").find({
        idOggetto: ObjectId(req.body._id)
      }).toArray(function(e, i) {
        _.map(i, function(r) {
          transporter.sendMail({
            from: "serverppw@gmail.com",
            to: r.mail,
            subject: "Il prodotto che stavi osservando è in sconto",
            text: "Il prodotto " + v[0].nome + " che stavi osservando ha ora uno sconto del " + req.body.sconto + "%"
          }, function(error, info) {
            if (error) {
              console.log(error);
            } else {
              console.log("Notifica su sconto, email inviata a", r.mail);
            }
          });
        })
      })

    }

    if (v[0].quantita == 0 && req.body.quantita > 0) {
      db.collection("notificaSuDisponibile").find({
        idOggetto: ObjectId(req.body._id)
      }).toArray(function(e, i) {
        _.map(i, function(r) {
          transporter.sendMail({
            from: "serverppw@gmail.com",
            to: r.mail,
            subject: "Il prodotto che stavi osservando è tornato disponbile",
            text: "Il prodotto " + v[0].nome + " che stavi osservando è tornato disponbile all'acquisto"
          }, function(error, info) {
            if (error) {
              console.log(error);
            } else {
              console.log("Notifica su quantità, email inviata a", r.mail);
            }
          });
        })
      })
    }

  })

  db.collection("prodotti").update({
    _id: ObjectId(req.body._id)
  }, {
    $set: {
      nome: req.body.nome,
      descrizione: req.body.descrizione,
      immagine: req.body.immagine,
      quantita: parseInt(req.body.quantita),
      prezzo: req.body.prezzo,
      sconto: req.body.sconto
    }
  }, function(err, doc) {
    if (err) {
      res.send({
        modificato: false
      })
    } else {
      res.send({
        modificato: true
      })
    }
  })

})


router.post("/admin/prodotti/rimosso", parserBodyJSON, function(req, res) {

  const db = req.app.locals.db

  console.log(req.body)

  db.collection("prodotti").remove({
    _id: ObjectId(req.body._id)
  }, function(err) {
    if (err) {
      res.send({
        rimosso: false
      })
    }
    res.send({
      rimosso: true
    })
  })

})


router.get("/admin", function(req, res) {
  res.render(path.join(__dirname, "../layout_e-commerce/admin.html"))
})

router.get("/noadmin", function(req, res) {
  res.render(path.join(__dirname, "../layout_e-commerce/noadmin.html"))
})

router.get("/", function(req, res) {
  res.render(path.join(__dirname, "../layout_e-commerce/index.html"))
})

router.get("/index", function(req, res) {
  res.render(path.join(__dirname, "../layout_e-commerce/index.html"))
})

router.get("/cart", function(req, res) {
  res.render(path.join(__dirname, "../layout_e-commerce/cart.html"))
})

router.get("/checkout", function(req, res) {
  res.render(path.join(__dirname, "../layout_e-commerce/checkout.html"))
})

router.get("/inserita", function(req, res) {
  res.render(path.join(__dirname, "../layout_e-commerce/inserita.html"))
})

router.get("/noninserita", function(req, res) {
  res.render(path.join(__dirname, "../layout_e-commerce/noninserita.html"))
})

router.get("/esiste", function(req, res) {
  res.render(path.join(__dirname, "../layout_e-commerce/esiste_gia.html"))
})


router.get("/login", function(req, res) {
  res.render(path.join(__dirname, "../layout_e-commerce/login.html"))
})
router.post("/login", parserBodyJSON, function(req, res) {

  const u = req.body.utente
  const p = req.body.password

  const db = req.app.locals.db

  db.collection("utenti").find({
    utente: u,
    password: p
  }).toArray(function(e, r) {

    if (r.length <= 0) {
      res.send({
        token: false
      })
    } else {
      res.send({
        token: jwt.genera()
      })
    }
  })


})

/*
  POST per aggiungere un'email alla collection newsletters
*/
router.post("/index", parserBody, function(req, res) {
  const m = req.body.mail
  const db = req.app.locals.db

  if (m == "") {
    res.redirect("/noninserita")
    return false
  }

  db.collection("newsletter").find({
    mail: m
  }).toArray(function(e, r) {
    if (r.length > 0) {
      res.redirect("/noninserita")
    } else {
      db.collection("newsletter").insert({
        mail: m
      })
      res.redirect("/inserita")
    }

  })
})

/*
  POST per aggiungere un email alla lista notifiche su quantità 
*/
router.post("/index/prodotto/notifica/disponibile/:id([a-zA-Z0-9\?]+)", parserBody, function(req, res) {
  const m = req.body.mail_dispo
  const id = req.params.id

  if (m == "") {
    res.redirect("/noninserita")
    return false
  }

  const db = req.app.locals.db

  db.collection("notificaSuDisponibile").find({
    idOggetto: ObjectId(id)
  }).toArray(function(e, r) {
    if (r.length > 0) {
      //email esiuste già 
      res.redirect("/esiste")
    } else {
      db.collection("notificaSuDisponibile").insert({
        idOggetto: ObjectId(id),
        mail: m
      })
      res.redirect("/inserita")
    }

  })
})

/*
  POST per aggiungere un email alla lista notifiche su prezzo 
*/
router.post("/index/prodotto/notifica/prezzo/:id([a-zA-Z0-9\?]+)", parserBody, function(req, res) {
  const m = req.body.mail_prezzo
  const id = req.params.id

  if (m == "") {
    res.redirect("/noninserita")
    return false
  }

  const db = req.app.locals.db

  db.collection("notificaSuPrezzo").find({
    idOggetto: ObjectId(id)
  }).toArray(function(e, r) {
    if (r.length > 0) {
      //email esiuste già 
      res.redirect("/esiste")
    } else {
      db.collection("notificaSuPrezzo").insert({
        idOggetto: ObjectId(id),
        mail: m
      })
      res.redirect("/inserita")
    }

  })
})

router.post("/index/prodotto/:id([a-zA-Z0-9\?]+)", parserBody, function(req, res) {

  const m = req.body.mail
  const id = req.params.prodotto
  console.log(m)

  if (m == "") {
    res.redirect("/noninserita")
    return false
  }

  const db = req.app.locals.db

  db.collection("disponibile").insert({
    mail: m,
    id: req.params.id
  })

})

//connessione al db

MongoClient.connect("mongodb://localhost:" + dbConfig.porta + "/" + dbConfig.nome, function(errore, db) {
  if (errore) {
    throw errore
  }

  //globale
  app.locals.db = db
})


app.listen(3000, function() {
  console.log("server avviato")
})