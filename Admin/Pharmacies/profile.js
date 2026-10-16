(() => {
  const store = window.CarePlusData;
  const pharmacyApi = window.CarePlusPharmacy;
  const id = new URLSearchParams(location.search).get("id");
  const root = document.querySelector("[data-profile-root]") || document.querySelector("#profile-root");
  const content = root?.querySelector("[data-profile-content]");
  const notFound = root?.querySelector("[data-profile-empty]");
  const pharmacy = () => store?.get("pharmacies", id);
  const inventory = row => Array.isArray(row?.inventory) ? row.inventory : [];
  const orders = () => (store?.list("orders") || []).filter(order => order.source === "pharmacy-order" && String(order.pharmacyId) === String(id)).sort((a,b) => new Date(b.placedAt || b.createdAt || 0) - new Date(a.placedAt || a.createdAt || 0));
  const escapeText = value => String(value ?? "");
  let toastTimer;
  function toast(message, error = false) {
    const box = document.querySelector("[data-toast]"); if (!box) return;
    box.textContent = message; box.classList.toggle("is-error", error); box.classList.add("is-visible");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => box.classList.remove("is-visible"), 3200);
  }
  function dateText(value, withTime = false) {
    if (!value) return "Not recorded";
    const date = new Date(value); if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString(undefined, withTime ? {year:"numeric",month:"short",day:"numeric",hour:"numeric",minute:"2-digit"} : {year:"numeric",month:"short",day:"numeric"});
  }
  function setText(selector, value) { const el = root.querySelector(selector); if (el) el.textContent = escapeText(value || "Not provided"); }
  function makeInfo(label, value) {
    const item = document.createElement("div"); item.className = "info-item";
    const title = document.createElement("span"); title.textContent = label;
    const text = document.createElement("strong"); text.textContent = escapeText(value || "Not provided");
    item.append(title, text); return item;
  }
  function render() {
    if (!root || !store) return;
    const row = pharmacy();
    content.hidden = !row; notFound.hidden = Boolean(row);
    if (!row) return;
    document.title = `${row.name || "Pharmacy"} | CarePlus Admin`;
    setText("[data-name]", row.name || "Pharmacy"); setText("[data-id]", `ID: ${row.id}`);
    const badge = root.querySelector("[data-status]"); const state = String(row.status || (row.open === false ? "Inactive" : "Active"));
    badge.textContent = state; badge.className = `status-badge ${state.toLowerCase() === "active" ? "is-good" : "is-muted"}`;
    const logo = root.querySelector("[data-logo]"); logo.replaceChildren();
    if (row.logo || row.image) { const image = document.createElement("img"); image.src = row.logo || row.image; image.alt = `${row.name || "Pharmacy"} logo`; image.onerror = () => { logo.textContent = (row.name || "P").slice(0,1).toUpperCase(); }; logo.append(image); }
    else logo.textContent = String(row.name || "P").slice(0,1).toUpperCase();
    const medicines = inventory(row), linkedOrders = orders();
    const available = medicines.filter(item => item.available !== false && item.listed !== false && Number(item.quantity) > 0).length;
    const pending = linkedOrders.filter(order => ["pending","placed","requested"].includes(String(order.status || "").toLowerCase())).length;
    const stats = root.querySelector("[data-stats]"); stats.replaceChildren();
    [["Total medicines", medicines.length],["Available", available],["Out of stock", medicines.filter(item => Number(item.quantity) <= 0).length],["Total orders", linkedOrders.length],["Pending orders", pending]].forEach(([label,value]) => { const card=document.createElement("div");card.className="profile-stat";const caption=document.createElement("span");caption.textContent=label;const number=document.createElement("strong");number.textContent=String(value);card.append(caption,number);stats.append(card); });
    const details = root.querySelector("[data-details]"); details.replaceChildren(
      makeInfo("Responsible pharmacist", row.responsiblePharmacist || row.ownerName), makeInfo("Phone", row.phone), makeInfo("Email", row.email),
      makeInfo("License number", row.licenseNumber), makeInfo("Address", row.address), makeInfo("City / area", row.city || row.area),
      makeInfo("Working hours", row.openingHours || row.hours), makeInfo("Emergency / 24-hour availability", row.emergency24h ? "Available 24 hours" : "Not listed"),
      makeInfo("Pharmacy hours status", row.open === false ? "Currently closed" : "Open"), makeInfo("Date added", dateText(row.createdAt)), makeInfo("Last updated", dateText(row.updatedAt || row.lastUpdatedAt, true))
    );
    renderMedicines(medicines); renderOrders(linkedOrders);
  }
  function renderMedicines(items) {
    const body = root.querySelector("[data-medicines]"); const empty = root.querySelector("[data-medicines-empty]"); body.replaceChildren(); empty.hidden = items.length > 0;
    items.forEach(item => {
      const tr=document.createElement("tr"), name=document.createElement("td"), block=document.createElement("div"); block.className="medicine-cell";
      if (item.image) { const img=document.createElement("img");img.className="medicine-image";img.src=item.image;img.alt="";img.onerror=()=>img.remove();block.append(img); }
      const strong=document.createElement("strong");strong.textContent=item.name || "Medicine";block.append(strong);name.append(block);
      const availability=Number(item.quantity)<=0?"Out of Stock":item.available===false||item.listed===false?"Unavailable":"Available";
      const status=document.createElement("span");status.className=`status-badge ${availability === "Available" ? "is-good" : "is-muted"}`;status.textContent=availability;
      const actions=document.createElement("div");actions.className="medicine-actions";
      [["Edit","edit"],["Update Price","price"],[item.listed!==false?"Set unavailable":"Set available","availability"],["Remove","remove"]].forEach(([label,action])=>{const button=document.createElement("button");button.type="button";button.className=`text-button ${action === "remove" ? "danger" : ""}`;button.dataset.medicineAction=action;button.dataset.medicineId=String(item.id);button.textContent=label;actions.append(button);});
      const cells=[name,cell(item.category),cell(item.activeIngredient),cell(`JOD ${Number(item.price||0).toFixed(2)}`),status,cell(String(Number(item.quantity)||0)),cell(dateText(item.updatedAt || item.lastUpdatedAt)),actions];
      cells.forEach((node,index)=>{const td=index===0||node.tagName==="TD"?node:document.createElement("td");if(td!==node)td.append(node);tr.append(td);});body.append(tr);
    });
  }
  function cell(value){const td=document.createElement("td");td.textContent=escapeText(value || "—");return td;}
  function renderOrders(items) {
    const body=root.querySelector("[data-orders]"),empty=root.querySelector("[data-orders-empty]");body.replaceChildren();empty.hidden=items.length>0;
    items.slice(0,20).forEach(order=>{
      const tr=document.createElement("tr"), names=(order.items||[]).map(line=>`${line.name||"Medicine"} × ${Number(line.quantity)||1}`).join(", ");
      [order.reference||order.id,order.customerReference||order.customerName||"Customer",names||"—",dateText(order.placedAt||order.createdAt,true),`JOD ${Number(order.total||0).toFixed(2)}`].forEach(value=>tr.append(cell(value)));
      const orderStatus=document.createElement("td"),badge=document.createElement("span");badge.className="status-badge";badge.textContent=order.status||"Pending";orderStatus.append(badge);tr.append(orderStatus,cell(order.paymentStatus||"Not recorded"));
      const actionTd=document.createElement("td"),manage=document.createElement("div");manage.className="order-manage";
      const transitions={Pending:["Confirmed","Cancelled"],Confirmed:["Preparing for Delivery","Cancelled"],"Preparing for Delivery":["Out for Delivery","Cancelled"]}[order.status]||[];
      if(transitions.length){const select=document.createElement("select");select.setAttribute("aria-label",`Next status for ${order.reference||order.id}`);select.dataset.orderStatus=String(order.id);const placeholder=document.createElement("option");placeholder.value="";placeholder.textContent="Update status";select.append(placeholder);transitions.forEach(next=>{const option=document.createElement("option");option.value=next;option.textContent=next;select.append(option);});const save=document.createElement("button");save.type="button";save.className="text-button";save.dataset.saveOrderStatus=String(order.id);save.textContent="Save";manage.append(select,save);}
      const button=document.createElement("button");button.type="button";button.className="text-button";button.dataset.orderDetail=String(order.id);button.textContent="View";manage.append(button);actionTd.append(manage);tr.append(actionTd);body.append(tr);
    });
  }
  const dialog=document.querySelector("[data-pharmacy-dialog]"), form=dialog?.querySelector("form"), fields=dialog?.querySelector("[data-form-fields]");
  function input(label,key,value,options={}) {
    const wrap=document.createElement("label");wrap.className=`field-label${options.wide?" is-wide":""}`;const title=document.createElement("span");title.textContent=label;wrap.append(title);
    let control;
    if(options.type==="checkbox"){control=document.createElement("input");control.type="checkbox";control.checked=Boolean(value);control.className="check-control";wrap.classList.add("check-field");}
    else if(options.type==="select"){control=document.createElement("select");options.choices.forEach(choice=>{const opt=document.createElement("option");opt.value=choice;opt.textContent=choice;opt.selected=String(value||"")===choice;control.append(opt);});}
    else if(options.type==="textarea"){control=document.createElement("textarea");control.value=value||"";}
    else {control=document.createElement("input");control.type=options.type||"text";control.value=value||"";if(options.min!=null)control.min=options.min;if(options.step)control.step=options.step;}
    control.name=key;if(options.required)control.required=true;wrap.append(control);return wrap;
  }
  function openForm(kind, item=null) {
    form.dataset.kind=kind;form.dataset.medicineId=item?.id||"";fields.replaceChildren();dialog.querySelector("[data-dialog-title]").textContent=kind==="profile"?"Edit Pharmacy":item?"Edit Medicine":"Add Medicine";dialog.querySelector("[data-dialog-eyebrow]").textContent=kind==="profile"?"PHARMACY DETAILS":"PHARMACY INVENTORY";form.querySelector("[data-form-feedback]").textContent="";
    if(kind==="profile"){
      const row=pharmacy();[["Pharmacy name","name",row.name,"text",true],["Logo or image URL","logo",row.logo||row.image,"url"],["Responsible pharmacist","responsiblePharmacist",row.responsiblePharmacist||row.ownerName],["Phone number","phone",row.phone,"tel"],["Email address","email",row.email,"email"],["License number","licenseNumber",row.licenseNumber],["Full address","address",row.address,"text",true],["City","city",row.city||row.area,"text",true],["Area","area",row.area],["Working hours","openingHours",row.openingHours||row.hours],["Status","status",row.status||"Active","select",true,{choices:["Active","Inactive"]}]].forEach(([label,key,value,type,required,extra])=>fields.append(input(label,key,value,{type,required,...extra,wide:["address","openingHours","logo"].includes(key)})));
      fields.append(input("Emergency / 24-hour availability","emergency24h",row.emergency24h,{type:"checkbox"}));
    } else {
      const value=item||{};[["Medicine name","name",value.name,"text",true],["Image URL","image",value.image,"url"],["Category","category",value.category,"text",true],["Active ingredient","activeIngredient",value.activeIngredient],["Price (JOD)","price",value.price,"number",true,{min:"0",step:"0.01"}],["Stock quantity","quantity",value.quantity??0,"number",true,{min:"0",step:"1"}],["Expiry date","expiry",value.expiry,"date"]].forEach(([label,key,val,type,required,extra])=>fields.append(input(label,key,val,{type,required,...extra,wide:key==="image"||key==="activeIngredient"})));
      fields.append(input("Listed in medicine search","listed",item?item.listed!==false:true,{type:"checkbox"}));
    }
    dialog.showModal();
  }
  root.querySelector("[data-edit-profile]").addEventListener("click",()=>openForm("profile"));
  root.querySelector("[data-add-medicine]").addEventListener("click",()=>openForm("medicine"));
  root.querySelector("[data-medicines]").addEventListener("click",event=>{
    const button=event.target.closest("[data-medicine-action]");if(!button)return;
    const row=pharmacy(),med=inventory(row).find(item=>String(item.id)===button.dataset.medicineId);if(!med)return;
    const action=button.dataset.medicineAction;
    if(action==="edit")openForm("medicine",med);
    if(action==="price")openForm("price",med);
    if(action==="availability"){
      const available=!(Number(med.quantity)>0&&med.available!==false&&med.listed!==false);
      const next=inventory(row).map(item=>String(item.id)===String(med.id)?{...item,listed:available,available:available&&Number(item.quantity)>0,updatedAt:new Date().toISOString()}:item);
      if(pharmacyApi.updatePharmacy(id,{inventory:next}))toast(`Availability updated for ${med.name}.`);else toast("Could not save medicine availability.",true);
    }
    if(action==="remove"&&window.confirm(`Remove ${med.name} from this pharmacy inventory?`)){
      if(pharmacyApi.updatePharmacy(id,{inventory:inventory(row).filter(item=>String(item.id)!==String(med.id))}))toast("Medicine removed.");else toast("Could not remove medicine.",true);
    }
  });
  form?.addEventListener("submit",event=>{
    event.preventDefault();const feedback=form.querySelector("[data-form-feedback]");feedback.textContent="";
    const data=new FormData(form),kind=form.dataset.kind;const row=pharmacy();if(!row){feedback.textContent="Pharmacy was removed. Reload the directory.";return;}
    const value=key=>String(data.get(key)||"").trim();
    if(kind==="profile"){
      const name=value("name"),email=value("email"),phone=value("phone");
      if(!name||!value("address")||!value("city")){feedback.textContent="Pharmacy name, address, and city are required.";return;}
      if(!email||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){feedback.textContent="Enter a valid pharmacy sign-in email address.";return;}
      if(phone&&!/^\+?[0-9\s().-]{7,24}$/.test(phone)){feedback.textContent="Enter a valid phone number (7–24 digits/characters).";return;}
      if(value("logo")){try{const imageUrl=new URL(value("logo"));if(!["http:","https:"].includes(imageUrl.protocol))throw new Error();}catch{feedback.textContent="Enter a valid image URL beginning with http:// or https://.";return;}}
      const status=value("status"),now=new Date().toISOString();
      const changes={name,logo:value("logo"),image:value("logo"),responsiblePharmacist:value("responsiblePharmacist"),phone,email,licenseNumber:value("licenseNumber"),address:value("address"),city:value("city"),area:value("area")||value("city"),location:value("city"),openingHours:value("openingHours"),hours:value("openingHours"),emergency24h:data.get("emergency24h")==="on",status,active:status==="Active",lastUpdatedAt:now};
      const auth=window.CarePlusAuth;
      const emailUpdate=email&&auth?.updatePharmacyLoginEmail?.(email,id);
      if(emailUpdate&&!emailUpdate.ok){feedback.textContent=emailUpdate.error||"Could not update the pharmacy sign-in email.";return;}
      if(!pharmacyApi.updatePharmacy(id,changes)){
        if(emailUpdate?.linked&&emailUpdate.previousEmail&&emailUpdate.previousEmail!==email)auth.updatePharmacyLoginEmail(emailUpdate.previousEmail,id);
        feedback.textContent="Could not save pharmacy changes in this browser.";return;
      }
      dialog.close();toast("Pharmacy profile saved.");render();return;
    }
    const old=inventory(row),medicineId=form.dataset.medicineId;const duplicate=old.some(item=>String(item.id)!==medicineId&&String(item.name||"").trim().toLowerCase()===value("name").toLowerCase());
    if(kind!=="price"&&(!value("name")||!value("category"))){feedback.textContent="Medicine name and category are required.";return;}
    if(duplicate){feedback.textContent="This pharmacy already has a medicine with that name.";return;}
    const price=Number(value("price"));if(!Number.isFinite(price)||price<0){feedback.textContent="Enter a valid non-negative price.";return;}
    let next;
    if(kind==="price")next=old.map(item=>String(item.id)===medicineId?{...item,price,updatedAt:new Date().toISOString()}:item);
    else{
      const quantity=Number(value("quantity"));if(!Number.isInteger(quantity)||quantity<0){feedback.textContent="Stock quantity must be a whole number greater than or equal to zero.";return;}
      const previous=old.find(item=>String(item.id)===medicineId);const medicine={...(previous||{}),id:medicineId||globalThis.crypto?.randomUUID?.()||`med-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,name:value("name"),image:value("image"),category:value("category"),activeIngredient:value("activeIngredient"),price,quantity,expiry:value("expiry"),listed:data.get("listed")==="on",updatedAt:new Date().toISOString()};medicine.available=medicine.listed&&quantity>0;
      next=previous?old.map(item=>String(item.id)===medicineId?medicine:item):[...old,medicine];
    }
    if(!pharmacyApi.updatePharmacy(id,{inventory:next})){feedback.textContent="Could not save medicine changes.";return;}
    dialog.close();toast(kind==="price"?"Medicine price updated.":medicineId?"Medicine updated.":"Medicine added.");render();
  });
  root.querySelector("[data-orders]").addEventListener("click",event=>{
    const save=event.target.closest("[data-save-order-status]");
    if(save){
      const select=root.querySelector(`[data-order-status="${CSS.escape(save.dataset.saveOrderStatus)}"]`),status=select?.value;
      if(!status){toast("Choose an order status first.",true);return;}
      const order=orders().find(item=>String(item.id)===save.dataset.saveOrderStatus);if(!order)return;
      const reason=status==="Cancelled"?window.prompt("Enter a cancellation reason:",""):"";if(status==="Cancelled"&&!String(reason||"").trim())return;
      const result=pharmacyApi.setOrderStatus(order.id,status,status==="Cancelled"?{reason}:{});
      if(!result.ok){toast(result.error||"Could not update order.",true);return;}
      toast(`Order ${order.reference||order.id} updated to ${status}.`);render();return;
    }
    const button=event.target.closest("[data-order-detail]");if(!button)return;const order=orders().find(item=>String(item.id)===button.dataset.orderDetail);if(!order)return;
    const modal=document.querySelector("[data-order-dialog]");const target=modal.querySelector("[data-order-detail]");target.replaceChildren();
    const grid=document.createElement("div");grid.className="order-detail-grid";
    [["Order ID",order.reference||order.id],["Customer",order.customerReference||order.customerName||"Customer"],["Items",(order.items||[]).map(line=>`${line.name} × ${line.quantity}`).join(", ")||"—"],["Order date",dateText(order.placedAt||order.createdAt,true)],["Subtotal",`JOD ${Number(order.subtotal||0).toFixed(2)}`],["Delivery",`JOD ${Number(order.deliveryFee||0).toFixed(2)}`],["Total",`JOD ${Number(order.total||0).toFixed(2)}`],["Order status",order.status||"Pending"],["Payment status",order.paymentStatus||"Not recorded"],["Payment method",order.paymentMethod||"Not recorded"]].forEach(([label,value])=>{const p=document.createElement("p"),strong=document.createElement("strong");strong.textContent=`${label}: `;p.append(strong,document.createTextNode(String(value)));grid.append(p);});
    target.append(grid);modal.showModal();
  });
  document.querySelectorAll("[data-close]").forEach(button=>button.addEventListener("click",()=>button.closest("dialog")?.close()));
  document.querySelectorAll("dialog").forEach(modal=>modal.addEventListener("click",event=>{if(event.target===modal)modal.close();}));
  document.querySelectorAll(".menu-toggle").forEach(button=>button.addEventListener("click",()=>{const open=document.body.classList.toggle("sidebar-open");button.setAttribute("aria-expanded",String(open));}));
  store?.subscribe(render);render();
  if(id&&new URLSearchParams(location.search).get("edit")==="1"&&pharmacy())openForm("profile");
})();
