

const authenticate =(req,res,next)=>{
    if(req.session.user){
        next()
    }
    else{
        // res.redirect('/')
        next()
    }
}

module.exports = authenticate