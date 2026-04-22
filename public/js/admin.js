function getCSRF(){return document.querySelector('meta[name="csrf-token"]')?.content||""}

async function api(url,body){
    const res=await fetch(url,{
        method:"POST",
        headers:{"Content-Type":"application/json","CSRF-Token":getCSRF()},
        body:JSON.stringify(body)
    });
    if(!res.ok){
        let msg="Request failed";
        try{const j=await res.json();msg=j.error||msg}catch{}
        alert(msg);
        throw new Error(msg);
    }
    return res.json().catch(()=>({}));
}

document.addEventListener("DOMContentLoaded",()=>{

    // tabs
    document.querySelectorAll("[data-tab]").forEach(btn=>{
        btn.addEventListener("click",()=>{
            document.querySelectorAll(".tab").forEach(t=>t.classList.add("hidden"));
            document.getElementById("tab-"+btn.dataset.tab)?.classList.remove("hidden");
        });
    });

    // search filter
    const search=document.getElementById("search");
    if(search){
        search.addEventListener("input",()=>{
            const val=search.value.toLowerCase();
            document.querySelectorAll("#user-table tr").forEach(tr=>{
                const name=tr.dataset.name||"";
                tr.style.display=name.includes(val)?"":"none";
            });
        });
    }

    document.querySelectorAll(".role-select").forEach(sel=>{
        sel.addEventListener("change",async()=>{
            await api("/admin/user/role",{userId:sel.dataset.id,role:sel.value});
        });
    });

    document.querySelectorAll(".disable-btn").forEach(btn=>{
        btn.addEventListener("click",async()=>{
            await api("/admin/user/disable",{userId:btn.dataset.id,mode:"permanent"});
            location.reload();
        });
    });

    document.querySelectorAll(".enable-btn").forEach(btn=>{
        btn.addEventListener("click",async()=>{
            await api("/admin/user/enable",{userId:btn.dataset.id});
            location.reload();
        });
    });

    document.querySelectorAll(".reset-btn").forEach(btn=>{
        btn.addEventListener("click",async()=>{
            const res=await api("/admin/user/reset-password",{userId:btn.dataset.id});
            alert(res.password||"Password reset");
        });
    });

    document.querySelectorAll(".force-reset-btn").forEach(btn=>{
        btn.addEventListener("click",async()=>{
            await api("/admin/user/force-reset",{userId:btn.dataset.id});
            alert("User will reset password on next login");
        });
    });

    document.querySelectorAll(".delete-btn").forEach(btn=>{
        btn.addEventListener("click",async()=>{
            if(!confirm("Delete this user?"))return;
            await api("/admin/user/delete",{userId:btn.dataset.id});
            location.reload();
        });
    });

    document.querySelectorAll(".delete-service-btn").forEach(btn=>{
        btn.addEventListener("click",async()=>{
            if(!confirm("Delete this service?"))return;
            await api("/admin/service/delete",{serviceId:btn.dataset.id});
            location.reload();
        });
    });

    const cu=document.getElementById("create-user-form");
    if(cu){
        cu.addEventListener("submit",async e=>{
            e.preventDefault();
            const data=Object.fromEntries(new FormData(cu));
            await api("/admin/user",data);
            location.reload();
        });
    }

    const cs=document.getElementById("create-service-form");
    if(cs){
        cs.addEventListener("submit",async e=>{
            e.preventDefault();
            const data=Object.fromEntries(new FormData(cs));
            await api("/admin/service",data);
            location.reload();
        });
    }

});
