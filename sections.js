//by mschro67
//last change: Jan 23 2026

const sections=document.getElementsByTagName("section");

function showAll(){
    for (const section of sections){
        if (section.hasAttribute("hidden")){
            section.removeAttribute("hidden");
        }
    }
}

function hideAll(){
    for (const section of sections){
        if (!section.hasAttribute("hidden")){
            section.toggleAttribute("hidden");
        }
    }
}

function show(selected){
    hideAll();
    document.getElementById(selected).toggleAttribute("hidden");

    window.scrollTo({
        top: 0,
        left: 0,
        behavior: 'smooth'
    });
}

function select(number){
    show(document.getElementById("select"+number).value);
}