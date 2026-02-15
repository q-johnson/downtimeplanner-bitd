/**
 * Downtime Planner for Blades in the Dark
 * Author: q-johnson
 */

// Main Downtime Planner Application
class DowntimePlannerApp extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
  constructor(options = {}) {
    super(options);
    // Load persisted activities from user flags
    this.activities = game.user.getFlag('downtimeplanner-bitd', 'activities') || [];
  }

  static DEFAULT_OPTIONS = {
    id: "downtime-planner",
    window: {
      title: "BITD.DowntimePlanner.Title",
      icon: "fas fa-clock",
      resizable: true
    },
    position: {
      width: 600,
      height: "auto"
    },
    tag: "div",
    classes: ["downtimeplanner-bitd"],
    actions: {
      addActivity: DowntimePlannerApp.onAddActivity,
      editActivity: DowntimePlannerApp.onEditActivity,
      removeActivity: DowntimePlannerApp.onRemoveActivity,
      startOver: DowntimePlannerApp.onStartOver,
      sendToChat: DowntimePlannerApp.onSendToChat
    }
  };

  static PARTS = {
    form: {
      template: "modules/downtimeplanner-bitd/templates/downtimeplanner-bitd.hbs"
    }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.activities = this.activities;
    context.canAdd = true;
    
    // Enrich HTML for description text
    context.description = await TextEditor.enrichHTML(
      game.i18n.localize("BITD.DowntimePlanner.Description"),
      { async: true }
    );
    
    // Check for trauma warning
    const character = game.user.character;
    const trauma = parseInt(character?.system?.trauma?.value || 0);
    const hasIndulgeVice = this.activities.some(a => a.type === "indulge-vice");
    
    console.log("=== Trauma Warning Check ===");
    console.log("Character:", character);
    console.log("Trauma value:", trauma);
    console.log("Has Indulge Vice activity:", hasIndulgeVice);
    console.log("Should show warning:", trauma > 0 && !hasIndulgeVice);
    console.log("=============================");
    
    context.showTraumaWarning = trauma > 0 && !hasIndulgeVice;
    context.traumaValue = trauma;
    
    return context;
  }

  static async onAddActivity(event, target) {
    const selectDialog = new SelectActivityDialog();
    const result = await selectDialog.wait();
    
    if (result && result.data !== null) {
      this.activities.push({
        id: foundry.utils.randomID(),
        type: result.type,
        data: result.data
      });
      
      // Persist to user flags
      await game.user.setFlag('downtimeplanner-bitd', 'activities', this.activities);
      
      this.render();
    }
  }

  static async onEditActivity(event, target) {
    const activityId = target.dataset.activityId;
    const activity = this.activities.find(a => a.id === activityId);
    
    if (!activity) return;
    
    // Open appropriate activity configuration window with existing data
    let activityDialog;
    let activityData;
    
    switch(activity.type) {
      case "acquire-asset":
        activityDialog = new AcquireAssetDialog(activity.data);
        activityData = await activityDialog.wait();
        break;
      case "long-term-project":
        activityDialog = new LongTermProjectDialog(activity.data);
        activityData = await activityDialog.wait();
        break;
      case "recover":
        activityDialog = new RecoverDialog(activity.data);
        activityData = await activityDialog.wait();
        break;
      case "reduce-heat":
        activityDialog = new ReduceHeatDialog(activity.data);
        activityData = await activityDialog.wait();
        break;
      case "train":
        activityDialog = new TrainDialog(activity.data);
        activityData = await activityDialog.wait();
        break;
      case "indulge-vice":
        activityDialog = new IndulgeViceDialog(activity.data);
        activityData = await activityDialog.wait();
        break;
      default:
        ui.notifications.info(game.i18n.localize("BITD.DowntimePlanner.FeatureInProgress"));
        return;
    }
    
    // Update activity data if confirmed
    if (activityData !== null) {
      activity.data = activityData;
      
      // Persist to user flags
      await game.user.setFlag('downtimeplanner-bitd', 'activities', this.activities);
      
      this.render();
    }
  }

  static async onRemoveActivity(event, target) {
    const activityId = target.dataset.activityId;
    this.activities = this.activities.filter(a => a.id !== activityId);
    
    // Persist to user flags
    await game.user.setFlag('downtimeplanner-bitd', 'activities', this.activities);
    
    this.render();
  }

  static async onStartOver(event, target) {
    const confirm = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize("BITD.DowntimePlanner.Confirm") },
      content: `<p>${game.i18n.localize("BITD.DowntimePlanner.StartOver.ConfirmMessage")}</p>`,
      rejectClose: false,
      modal: true
    });
    
    if (confirm) {
      this.activities = [];
      
      // Clear persisted data
      await game.user.unsetFlag('downtimeplanner-bitd', 'activities');
      
      this.render();
    }
  }

  static async onSendToChat(event, target) {
    if (this.activities.length === 0) {
      ui.notifications.warn(game.i18n.localize("BITD.DowntimePlanner.NoActivitiesWarning"));
      return;
    }

    const confirm = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize("BITD.DowntimePlanner.Confirm") },
      content: `<p>${game.i18n.localize("BITD.DowntimePlanner.SendChoicesToChat.ConfirmMessage")}</p>`,
      rejectClose: false,
      modal: true
    });
    
    if (confirm) {
      // Post each activity to chat
      for (const activity of this.activities) {
        const chatContent = DowntimePlannerApp._formatActivityForChat(activity);
        
        await ChatMessage.create({
          user: game.user.id,
          speaker: ChatMessage.getSpeaker({ actor: game.user.character }),
          content: chatContent,
          type: CONST.CHAT_MESSAGE_TYPES.OTHER
        });
      }
      
      this.activities = [];
      
      // Clear persisted data
      await game.user.unsetFlag('downtimeplanner-bitd', 'activities');
      
      this.render();
    }
  }

  static _formatActivityForChat(activity) {
    switch(activity.type) {
      case "acquire-asset":
        return this._formatAcquireAssetChat(activity);
      case "long-term-project":
        return this._formatLongTermProjectChat(activity);
      case "recover":
        return this._formatRecoverChat(activity);
      case "reduce-heat":
        return this._formatReduceHeatChat(activity);
      case "train":
        return this._formatTrainChat(activity);
      case "indulge-vice":
        return this._formatIndulgeViceChat(activity);
      default:
        return `<p><strong>${activity.type}</strong></p>`;
    }
  }
/*
* Acquire Asset Chat Message Formatting
*/
  static _formatAcquireAssetChat(activity) {
    const data = activity.data;
    const character = game.user.character;
    const characterName = character?.name || game.user.name;
    const crewData = character?.system?.crew?.[0];
    const crewName = crewData?.name;
    
    // Get the full crew actor to access tier
    const crewId = crewData?.id;
    const crewActor = crewId ? game.actors.get(crewId) : null;
    const crewTier = crewActor?.system?.tier ? parseInt(crewActor.system.tier) : 0;
    
    let html = `
      <div class="downtime-chat-card acquire-asset-card">
        <div class="card-header">
          <i class="fas fa-shopping-cart"></i>
          <span class="activity-title">${game.i18n.localize("BITD.DowntimePlanner.AcquireAsset.Title")}</span>
        </div>
        <div class="card-body">
          <div class="activity-description">
            ${game.i18n.format("BITD.DowntimePlanner.Chat.AcquiringAsset", {character: characterName, asset: data.assetName})}
          </div>
    `;
    
    if (data.qualityTier) {
      html += `
          <div class="detail-row">
            <span class="detail-label">${game.i18n.localize("BITD.DowntimePlanner.Chat.RequiresQualityTier")}</span>
            <span class="detail-value">${data.qualityTier}</span>
          </div>
      `;
    }

    html += `
      <div class="detail-row">
      <span class="detail-label">${game.i18n.localize("BITD.DowntimePlanner.Chat.CurrentCrewTier")}</span>
      <span class="detail-value">${crewTier}</span>
    </div>
    `;

    html += `
          <div class="progress-info">
            <p><em>${game.i18n.localize("BITD.DowntimePlanner.Chat.RollCrewTier")}</em></p>
            <div class="roll-results-grid">
              <span class="dice"><i class="far fa-dice-one"></i><i class="far fa-dice-two"></i><i class="far fa-dice-three"></i></span>
              <span>${game.i18n.localize("BITD.DowntimePlanner.Chat.Quality")} ${Math.max(0, crewTier - 1)}</span>
              <span class="dice"><i class="far fa-dice-four"></i><i class="far fa-dice-five"></i></span>
              <span>${game.i18n.localize("BITD.DowntimePlanner.Chat.Quality")} ${crewTier}</span>
              <span class="dice"><i class="far fa-dice-six"></i></span>
              <span>${game.i18n.localize("BITD.DowntimePlanner.Chat.Quality")} ${crewTier + 1}</span>
              <span class="dice"><i class="far fa-dice-six"></i><i class="far fa-dice-six"></i></span>
              <span>${game.i18n.localize("BITD.DowntimePlanner.Chat.Quality")} ${crewTier + 2}</span>
            </div>
          </div>
    `;

    // Modifiers section
    const hasModifiers = data.acquiredBefore || data.restrictedAsset;
    if (hasModifiers) {
      html += `<div class="modifiers-section">`;
      
      if (data.acquiredBefore) {
        html += `
          <div class="modifier bonus">
            <i class="fas fa-dice-d6"></i>
            <span>${game.i18n.localize("BITD.DowntimePlanner.Chat.PreviouslyAcquiredBonus")}</span>
          </div>
        `;
      }
      
      if (data.restrictedAsset) {
        html += `
          <div class="modifier consequence">
            <i class="fas fa-fire"></i>
            <span>${game.i18n.localize("BITD.DowntimePlanner.Chat.RestrictedAssetHeat")}</span>
          </div>
        `;
      }
      
      html += `</div>`;
    }
    
    html += `
        </div>
      </div>
    `;
    
    return html;
  }
/*
* Long-Term Project Chat Message Formatting
*/
  static _formatLongTermProjectChat(activity) {
    const data = activity.data;
    const character = game.user.character;
    const characterName = character?.name || game.user.name;
    const crewData = character?.system?.crew?.[0];
    const crewId = crewData?.id;
    const crewActor = crewId ? game.actors.get(crewId) : null;
    const crewTier = crewActor?.system?.tier ? parseInt(crewActor.system.tier) : 0;
    const actionName = game.i18n.localize(`BITD.DowntimePlanner.Actions.${data.actionRoll}`);
    
    let html = `
      <div class="downtime-chat-card long-term-project-card">
        <div class="card-header">
          <i class="fas fa-tasks"></i>
          <span class="activity-title">${game.i18n.localize("BITD.DowntimePlanner.LongTermProject.Title")}</span>
        </div>
        <div class="card-body">
          <div class="activity-description">
            ${game.i18n.format("BITD.DowntimePlanner.Chat.WorkingOnProject", {character: characterName, project: data.projectName})}
          </div>
          <div class="detail-row">
            <span class="detail-label">${game.i18n.localize("BITD.DowntimePlanner.Chat.ActionRoll")}</span>
            <span class="detail-value">${actionName}</span>
          </div>
          <div class="progress-info">
            <p><em>${game.i18n.localize("BITD.DowntimePlanner.Chat.MarkProjectSegments")}</em></p>
            <div class="roll-results-grid">
              <span class="dice"><i class="far fa-dice-one"></i><i class="far fa-dice-two"></i><i class="far fa-dice-three"></i></span>
              <span>${game.i18n.localize("BITD.DowntimePlanner.Chat.OneSegment")}</span>
              <span class="dice"><i class="far fa-dice-four"></i><i class="far fa-dice-five"></i></span>
              <span>${game.i18n.localize("BITD.DowntimePlanner.Chat.TwoSegments")}</span>
              <span class="dice"><i class="far fa-dice-six"></i></span>
              <span>${game.i18n.localize("BITD.DowntimePlanner.Chat.ThreeSegments")}</span>
              <span class="dice"><i class="far fa-dice-six"></i><i class="far fa-dice-six"></i></span>
              <span>${game.i18n.localize("BITD.DowntimePlanner.Chat.FiveSegments")}</span>
            </div>
          </div>
        </div>
      </div>
    `;
    
    return html;
  }
/*
* Recover Chat Message Formatting
*/
  static _formatRecoverChat(activity) {
    const data = activity.data;
    const character = game.user.character;
    const characterName = character?.name || game.user.name;
    
    // Get localized string directly using the capitalized value
    const methodKey = `BITD.DowntimePlanner.Recover.${data.healingMethod}`;
    const methodName = game.i18n.localize(methodKey);
    
    // Build quality/tinker info
    let qualityInfo = '';
    if (data.healingMethod === 'Contact' && data.contactQuality) {
      qualityInfo = `
        <div class="detail-row">
          <span class="detail-label">${game.i18n.localize("BITD.DowntimePlanner.Recover.ContactQuality")}</span>
          <span class="detail-value">${data.contactQuality}</span>
        </div>
      `;
    } else if (data.healingMethod === 'Crewmate' && data.crewmateTinker) {
      qualityInfo = `
        <div class="detail-row">
          <span class="detail-label">${game.i18n.localize("BITD.DowntimePlanner.Recover.CrewmateTinker")}</span>
          <span class="detail-value">${data.crewmateTinker}</span>
        </div>
      `;
    }
    
    let html = `
      <div class="downtime-chat-card recover-card">
        <div class="card-header">
          <i class="fas fa-heart"></i>
          <span class="activity-title">${game.i18n.localize("BITD.DowntimePlanner.Recover.Title")}</span>
        </div>
        <div class="card-body">
          <div class="activity-description">
            ${game.i18n.format("BITD.DowntimePlanner.Chat.SeekingTreatment", {character: characterName})}
          </div>
          <div class="detail-row">
            <span class="detail-label">${game.i18n.localize("BITD.DowntimePlanner.Chat.HealingMethod")}</span>
            <span class="detail-value">${methodName}</span>
          </div>
          ${qualityInfo}
          <div class="progress-info">
            <p><em>${game.i18n.localize("BITD.DowntimePlanner.Chat.MarkHealingSegments")}</em></p>
            <div class="roll-results-grid">
              <span class="dice"><i class="far fa-dice-one"></i><i class="far fa-dice-two"></i><i class="far fa-dice-three"></i></span>
              <span>${game.i18n.localize("BITD.DowntimePlanner.Chat.OneSegment")}</span>
              <span class="dice"><i class="far fa-dice-four"></i><i class="far fa-dice-five"></i></span>
              <span>${game.i18n.localize("BITD.DowntimePlanner.Chat.TwoSegments")}</span>
              <span class="dice"><i class="far fa-dice-six"></i></span>
              <span>${game.i18n.localize("BITD.DowntimePlanner.Chat.ThreeSegments")}</span>
              <span class="dice"><i class="far fa-dice-six"></i><i class="far fa-dice-six"></i></span>
              <span>${game.i18n.localize("BITD.DowntimePlanner.Chat.FiveSegments")}</span>
            </div>
          </div>
        </div>
      </div>
    `;
    
    return html;
  }
/*
* Reduce Heat Chat Message Formatting
*/
  static _formatReduceHeatChat(activity) {
    const data = activity.data;
    const character = game.user.character;
    const characterName = character?.name || game.user.name;
    const crewData = character?.system?.crew?.[0];
    const crewName = crewData?.name;
    const crewId = crewData?.id;
    const crewActor = crewId ? game.actors.get(crewId) : null;
    const crewTier = crewActor?.system?.tier ? parseInt(crewActor.system.tier) : 0;
    
    // Get localized action name
    const actionKey = `BITD.DowntimePlanner.Actions.${data.actionRoll}`;
    const actionName = game.i18n.localize(actionKey);
    
    let html = `
      <div class="downtime-chat-card reduce-heat-card">
        <div class="card-header">
          <i class="fas fa-fire-extinguisher"></i>
          <span class="activity-title">${game.i18n.localize("BITD.DowntimePlanner.ReduceHeat.Title")}</span>
        </div>
        <div class="card-body">
          <div class="activity-description">
            ${game.i18n.format("BITD.DowntimePlanner.Chat.ReducingHeat", {character: characterName, method: data.heatReductionMethod})}
          </div>
          <div class="detail-row">
            <span class="detail-label">${game.i18n.localize("BITD.DowntimePlanner.Chat.ActionRoll")}</span>
            <span class="detail-value">${actionName}</span>
          </div>
          <div class="progress-info">
            <p><em>${game.i18n.localize("BITD.DowntimePlanner.Chat.ReduceHeatRollResult")}</em></p>
            <div class="roll-results-grid">
              <span class="dice"><i class="far fa-dice-one"></i><i class="far fa-dice-two"></i><i class="far fa-dice-three"></i></span>
              <span>${game.i18n.localize("BITD.DowntimePlanner.Chat.ReduceHeatBy1")}</span>
              <span class="dice"><i class="far fa-dice-four"></i><i class="far fa-dice-five"></i></span>
              <span>${game.i18n.localize("BITD.DowntimePlanner.Chat.ReduceHeatBy2")}</span>
              <span class="dice"><i class="far fa-dice-six"></i></span>
              <span>${game.i18n.localize("BITD.DowntimePlanner.Chat.ReduceHeatBy3")}</span>
              <span class="dice"><i class="far fa-dice-six"></i><i class="far fa-dice-six"></i></span>
              <span>${game.i18n.localize("BITD.DowntimePlanner.Chat.ReduceHeatBy5")}</span>
            </div>
          </div>
        </div>
      </div>
    `;
    
    return html;
  }
/*
* Train Chat Message Formatting
*/
  static _formatTrainChat(activity) {
    const data = activity.data;
    const character = game.user.character;
    const characterName = character?.name || game.user.name;
    
    // Get localized training type name
    let trainingTypeKey;
    if (data.trainingType === "Playbook") {
      trainingTypeKey = "BITD.DowntimePlanner.Train.Playbook";
    } else {
      trainingTypeKey = `BITD.DowntimePlanner.Attributes.${data.trainingType}`;
    }
    const trainingTypeName = game.i18n.localize(trainingTypeKey);
    
    // Calculate total XP
    let totalXP = 1;
    if (data.crewUpgrade) {
      totalXP = 2;
    }
    
    let html = `
      <div class="downtime-chat-card train-card">
        <div class="card-header">
          <i class="fas fa-dumbbell"></i>
          <span class="activity-title">${game.i18n.localize("BITD.DowntimePlanner.Train.Title")}</span>
        </div>
        <div class="card-body">
          <div class="activity-description">
            ${game.i18n.format("BITD.DowntimePlanner.Chat.SpendingDowntimeTraining", {character: characterName})}
          </div>
          <div class="detail-row">
            <span class="detail-label">${game.i18n.localize("BITD.DowntimePlanner.Chat.Training")}</span>
            <span class="detail-value">${trainingTypeName}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">${game.i18n.localize("BITD.DowntimePlanner.Chat.XPGained")}</span>
            <span class="detail-value">${game.i18n.format("BITD.DowntimePlanner.Chat.XPLabel", {xp: totalXP})}</span>
          </div>
    `;
    
    if (data.crewUpgrade) {
      html += `
          <div class="modifiers-section">
            <div class="modifier bonus">
              <i class="fas fa-plus"></i>
              <span>${game.i18n.localize("BITD.DowntimePlanner.Chat.CrewTrainingUpgrade")}</span>
            </div>
          </div>
      `;
    }
    
    html += `
        </div>
      </div>
    `;
    
    return html;
  }
/*
* Indulge Vice Chat Message Formatting
*/
  static _formatIndulgeViceChat(activity) {
    const data = activity.data;
    const character = game.user.character;
    const characterName = character?.name || game.user.name;
    
    // Get localized attribute name
    const attributeKey = `BITD.DowntimePlanner.Attributes.${data.lowestAttribute}`;
    const attributeName = game.i18n.localize(attributeKey);
    
    let html = `
      <div class="downtime-chat-card indulge-vice-card">
        <div class="card-header">
          <i class="fas fa-cocktail"></i>
          <span class="activity-title">${game.i18n.localize("BITD.DowntimePlanner.IndulgeVice.Title")}</span>
        </div>
        <div class="card-body">
          <div class="activity-description">
            ${game.i18n.format("BITD.DowntimePlanner.Chat.IndulgingVice", {character: characterName, indulgence: data.indulgenceDescription})}
          </div>
          <div class="detail-row">
            <span class="detail-label">${game.i18n.localize("BITD.DowntimePlanner.Chat.VicePurveyor")}</span>
            <span class="detail-value">${data.vicePurveyor}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">${game.i18n.localize("BITD.DowntimePlanner.Chat.ResistanceRoll")}</span>
            <span class="detail-value">${attributeName}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">${game.i18n.localize("BITD.DowntimePlanner.Chat.CurrentStress")}</span>
            <span class="detail-value">${data.currentStress}</span>
          </div>
          <div class="progress-info">
            <p><em>${game.i18n.localize("BITD.DowntimePlanner.Chat.RollResistance")}</em></p>
            <p><em>${game.i18n.localize("BITD.DowntimePlanner.Chat.OverindulgeWarning")}</em></p>
          </div>
          <div class="rules-reference">
            <a class="rules-link" data-rule="overindulge">
              <i class="fas fa-question-circle"></i> ${game.i18n.localize("BITD.DowntimePlanner.Chat.WhatHappensOverindulge")}
            </a>
          </div>
        </div>
      </div>
    `;
    
    return html;
  }

  static _formatGenericActivityChat(activity) {
    const character = game.user.character;
    const characterName = character?.name || game.user.name;
    const activityTitle = game.i18n.localize(`BITD.DowntimePlanner.${this._getActivityKey(activity.type)}.Title`);
    
    return `
      <div class="downtime-chat-card generic-activity-card">
        <div class="card-header">
          <i class="fas fa-clock"></i>
          <span class="activity-title">${activityTitle}</span>
        </div>
        <div class="card-body">
          <div class="player-name">${characterName}</div>
          <div class="activity-description">
            <em>Activity details not yet implemented.</em>
          </div>
        </div>
      </div>
    `;
  }

  static _getActivityKey(activityType) {
    const keyMap = {
      "acquire-asset": "AcquireAsset",
      "long-term-project": "LongTermProject",
      "recover": "Recover",
      "reduce-heat": "ReduceHeat",
      "train": "Train",
      "indulge-vice": "IndulgeVice"
    };
    return keyMap[activityType] || activityType;
  }
}

// Select Activity Dialog
class SelectActivityDialog extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
  constructor(options = {}) {
    super(options);
    this._resolve = null;
  }

  static DEFAULT_OPTIONS = {
    id: "select-activity-dialog",
    window: {
      title: "BITD.DowntimePlanner.SelectActivity",
      icon: "fas fa-list"
    },
    position: {
      width: 500,
      height: "auto"
    },
    classes: ["select-activity-dialog"],
    actions: {
      selectActivity: SelectActivityDialog.onSelectActivity
    }
  };

  static PARTS = {
    form: {
      template: "modules/downtimeplanner-bitd/templates/select-activity.hbs"
    }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.activities = [
      { id: "acquire-asset", name: "BITD.DowntimePlanner.AcquireAsset.Title", icon: "fas fa-shopping-cart" },
      { id: "long-term-project", name: "BITD.DowntimePlanner.LongTermProject.Title", icon: "fas fa-tasks" },
      { id: "recover", name: "BITD.DowntimePlanner.Recover.Title", icon: "fas fa-heart" },
      { id: "reduce-heat", name: "BITD.DowntimePlanner.ReduceHeat.Title", icon: "fas fa-fire-extinguisher" },
      { id: "train", name: "BITD.DowntimePlanner.Train.Title", icon: "fas fa-dumbbell" },
      { id: "indulge-vice", name: "BITD.DowntimePlanner.IndulgeVice.Title", icon: "fas fa-cocktail" }
    ];
    
    // Enrich activity names for localization
    for (let activity of context.activities) {
      activity.enrichedName = await TextEditor.enrichHTML(game.i18n.localize(activity.name), { async: true });
    }
    
    return context;
  }

  static async onSelectActivity(event, target) {
    const activityType = target.dataset.activityType;
    
    // Open appropriate activity configuration window
    let activityDialog;
    let activityData;
    
    switch(activityType) {
      case "acquire-asset":
        activityDialog = new AcquireAssetDialog();
        activityData = await activityDialog.wait();
        break;
      case "long-term-project":
        activityDialog = new LongTermProjectDialog();
        activityData = await activityDialog.wait();
        break;
      case "recover":
        activityDialog = new RecoverDialog();
        activityData = await activityDialog.wait();
        break;
      case "reduce-heat":
        activityDialog = new ReduceHeatDialog();
        activityData = await activityDialog.wait();
        break;
      case "train":
        activityDialog = new TrainDialog();
        activityData = await activityDialog.wait();
        break;
      case "indulge-vice":
        activityDialog = new IndulgeViceDialog();
        activityData = await activityDialog.wait();
        break;
    }
    
    if (this._resolve) {
      this._resolve({ type: activityType, data: activityData });
    }
    this.close();
  }

  wait() {
    this.render(true);
    return new Promise(resolve => {
      this._resolve = resolve;
    });
  }

  async close(options = {}) {
    if (this._resolve) {
      this._resolve(null);
    }
    return super.close(options);
  }
}

// Acquire Asset Activity Dialog
class AcquireAssetDialog extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
  constructor(data = {}, options = {}) {
    super(options);
    this.data = data;
    this._resolve = null;
  }

  static DEFAULT_OPTIONS = {
    id: "acquire-asset-dialog",
    window: {
      title: "BITD.DowntimePlanner.AcquireAsset.Title",
      icon: "fas fa-shopping-cart"
    },
    position: {
      width: 800,
      height: "auto"
    },
    classes: ["acquire-asset-dialog"],
    actions: {
      confirm: AcquireAssetDialog.onConfirm,
      cancel: AcquireAssetDialog.onCancel
    }
  };

  static PARTS = {
    form: {
      template: "modules/downtimeplanner-bitd/templates/acquire-asset.hbs"
    }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    
    // Enrich HTML for description
    context.description = await TextEditor.enrichHTML(
      game.i18n.localize("BITD.DowntimePlanner.AcquireAsset.Description"),
      { async: true }
    );
    
    // Pass existing data to template
    context.data = this.data || {};
    
    return context;
  }

  static async onConfirm(event, target) {
    const form = this.element.querySelector('form');
    const formData = new FormData(form);
    
    const assetName = formData.get('assetName')?.trim();
    if (!assetName) {
      ui.notifications.warn(game.i18n.localize("BITD.DowntimePlanner.AcquireAsset.AssetNameRequired"));
      return;
    }
    
    const data = {
      assetName: assetName,
      qualityTier: formData.get('qualityTier') || null,
      acquiredBefore: formData.has('acquiredBefore'),
      restrictedAsset: formData.has('restrictedAsset')
    };
    
    if (this._resolve) {
      this._resolve(data);
    }
    this.close();
  }

  static async onCancel(event, target) {
    if (this._resolve) {
      this._resolve(null);
    }
    this.close();
  }

  wait() {
    this.render(true);
    return new Promise(resolve => {
      this._resolve = resolve;
    });
  }

  async close(options = {}) {
    if (this._resolve) {
      this._resolve(null);
    }
    return super.close(options);
  }
}

// Long-Term Project Activity Dialog
class LongTermProjectDialog extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
  constructor(data = {}, options = {}) {
    super(options);
    this.data = data;
    this._resolve = null;
  }

  static DEFAULT_OPTIONS = {
    id: "long-term-project-dialog",
    window: {
      title: "BITD.DowntimePlanner.LongTermProject.Title",
      icon: "fas fa-tasks"
    },
    position: {
      width: 800,
      height: "auto"
    },
    classes: ["long-term-project-dialog"],
    actions: {
      confirm: LongTermProjectDialog.onConfirm,
      cancel: LongTermProjectDialog.onCancel
    }
  };

  static PARTS = {
    form: {
      template: "modules/downtimeplanner-bitd/templates/long-term-project.hbs"
    }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    
    // Enrich HTML for description
    context.description = await TextEditor.enrichHTML(
      game.i18n.localize("BITD.DowntimePlanner.LongTermProject.Description"),
      { async: true }
    );
    
    // Pass existing data to template
    context.data = this.data || {};
    
    return context;
  }

  static async onConfirm(event, target) {
    const form = this.element.querySelector('form');
    const formData = new FormData(form);
    
    const projectName = formData.get('projectName')?.trim();
    const actionRoll = formData.get('actionRoll');
    
    if (!projectName) {
      ui.notifications.warn(game.i18n.localize("BITD.DowntimePlanner.LongTermProject.ProjectNameRequired"));
      return;
    }
    
    if (!actionRoll) {
      ui.notifications.warn(game.i18n.localize("BITD.DowntimePlanner.LongTermProject.ActionRequired"));
      return;
    }
    
    const data = {
      projectName: projectName,
      actionRoll: actionRoll
    };
    
    if (this._resolve) {
      this._resolve(data);
    }
    this.close();
  }

  static async onCancel(event, target) {
    if (this._resolve) {
      this._resolve(null);
    }
    this.close();
  }

  wait() {
    this.render(true);
    return new Promise(resolve => {
      this._resolve = resolve;
    });
  }

  async close(options = {}) {
    if (this._resolve) {
      this._resolve(null);
    }
    return super.close(options);
  }
}

// Recover Activity Dialog
class RecoverDialog extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
  constructor(data = {}, options = {}) {
    super(options);
    this.data = data;
    this._resolve = null;
  }

  static DEFAULT_OPTIONS = {
    id: "recover-dialog",
    window: {
      title: "BITD.DowntimePlanner.Recover.Title",
      icon: "fas fa-heart"
    },
    position: {
      width: 800,
      height: "auto"
    },
    classes: ["recover-dialog"],
    actions: {
      confirm: RecoverDialog.onConfirm,
      cancel: RecoverDialog.onCancel
    }
  };

  static PARTS = {
    form: {
      template: "modules/downtimeplanner-bitd/templates/recover.hbs"
    }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    
    // Enrich HTML for description
    context.description = await TextEditor.enrichHTML(
      game.i18n.localize("BITD.DowntimePlanner.Recover.Description"),
      { async: true }
    );
    
    // Pass existing data to template
    context.data = this.data || {};
    
    return context;
  }

  _onRender(context, options) {
    super._onRender(context, options);
    
    // Add event listener for healing method changes
    const healingMethodSelect = this.element.querySelector('#healing-method');
    const contactQualityGroup = this.element.querySelector('#contact-quality-group');
    const crewmateTinkerGroup = this.element.querySelector('#crewmate-tinker-group');
    
    const updateVisibility = () => {
      const method = healingMethodSelect.value;
      if (contactQualityGroup) {
        contactQualityGroup.style.display = method === 'Contact' ? 'block' : 'none';
      }
      if (crewmateTinkerGroup) {
        crewmateTinkerGroup.style.display = method === 'Crewmate' ? 'block' : 'none';
      }
    };
    
    // Set initial visibility
    updateVisibility();
    
    // Update on change
    if (healingMethodSelect) {
      healingMethodSelect.addEventListener('change', updateVisibility);
    }
  }

  static async onConfirm(event, target) {
    const form = this.element.querySelector('form');
    const formData = new FormData(form);
    
    const healingMethod = formData.get('healingMethod');
    
    if (!healingMethod) {
      ui.notifications.warn(game.i18n.localize("BITD.DowntimePlanner.Recover.MethodRequired"));
      return;
    }
    
    const data = {
      healingMethod: healingMethod,
      contactQuality: formData.get('contactQuality'),
      crewmateTinker: formData.get('crewmateTinker')
    };
    
    if (this._resolve) {
      this._resolve(data);
    }
    this.close();
  }

  static async onCancel(event, target) {
    if (this._resolve) {
      this._resolve(null);
    }
    this.close();
  }

  wait() {
    this.render(true);
    return new Promise(resolve => {
      this._resolve = resolve;
    });
  }

  async close(options = {}) {
    if (this._resolve) {
      this._resolve(null);
    }
    return super.close(options);
  }
}

// Reduce Heat Dialog
class ReduceHeatDialog extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
  constructor(data = {}, options = {}) {
    super(options);
    this.data = data;
    this._resolve = null;
  }

  static DEFAULT_OPTIONS = {
    id: "reduce-heat-dialog",
    window: {
      title: "BITD.DowntimePlanner.ReduceHeat.Title",
      icon: "fas fa-fire-extinguisher"
    },
    position: {
      width: 800,
      height: "auto"
    },
    classes: ["reduce-heat-dialog"],
    actions: {
      confirm: ReduceHeatDialog.onConfirm,
      cancel: ReduceHeatDialog.onCancel
    }
  };

  static PARTS = {
    form: {
      template: "modules/downtimeplanner-bitd/templates/reduce-heat.hbs"
    }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.data = this.data;
    
    // Enrich description HTML
    context.description = await TextEditor.enrichHTML(
      game.i18n.localize("BITD.DowntimePlanner.ReduceHeat.Description"),
      { async: true }
    );
    
    return context;
  }

  static async onConfirm(event, target) {
    const form = this.element.querySelector("form");
    const formData = new FormData(form);
    const heatReductionMethod = formData.get("heatReductionMethod")?.trim();
    const actionRoll = formData.get("actionRoll");
    
    // Validate
    if (!heatReductionMethod) {
      ui.notifications.warn(game.i18n.localize("BITD.DowntimePlanner.ReduceHeat.MethodRequired"));
      return;
    }
    
    if (!actionRoll) {
      ui.notifications.warn(game.i18n.localize("BITD.DowntimePlanner.ReduceHeat.ActionRequired"));
      return;
    }
    
    const data = {
      heatReductionMethod: heatReductionMethod,
      actionRoll: actionRoll
    };
    
    if (this._resolve) {
      this._resolve(data);
    }
    this.close();
  }

  static async onCancel(event, target) {
    if (this._resolve) {
      this._resolve(null);
    }
    this.close();
  }

  wait() {
    this.render(true);
    return new Promise(resolve => {
      this._resolve = resolve;
    });
  }

  async close(options = {}) {
    if (this._resolve) {
      this._resolve(null);
    }
    return super.close(options);
  }
}

// Train Dialog
class TrainDialog extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
  constructor(data = {}, options = {}) {
    super(options);
    this.data = data;
    this._resolve = null;
  }

  static DEFAULT_OPTIONS = {
    id: "train-dialog",
    window: {
      title: "BITD.DowntimePlanner.Train.Title",
      icon: "fas fa-dumbbell"
    },
    position: {
      width: 800,
      height: "auto"
    },
    classes: ["train-dialog"],
    actions: {
      confirm: TrainDialog.onConfirm,
      cancel: TrainDialog.onCancel
    }
  };

  static PARTS = {
    form: {
      template: "modules/downtimeplanner-bitd/templates/train.hbs"
    }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.data = this.data;
    
    // Enrich description HTML
    context.description = await TextEditor.enrichHTML(
      game.i18n.localize("BITD.DowntimePlanner.Train.Description"),
      { async: true }
    );
    
    return context;
  }

  static async onConfirm(event, target) {
    const form = this.element.querySelector("form");
    const formData = new FormData(form);
    const trainingType = formData.get("trainingType");
    const crewUpgrade = formData.get("crewUpgrade") === "on";
    
    // Validate
    if (!trainingType) {
      ui.notifications.warn(game.i18n.localize("BITD.DowntimePlanner.Train.TypeRequired"));
      return;
    }
    
    const data = {
      trainingType: trainingType,
      crewUpgrade: crewUpgrade
    };
    
    if (this._resolve) {
      this._resolve(data);
    }
    this.close();
  }

  static async onCancel(event, target) {
    if (this._resolve) {
      this._resolve(null);
    }
    this.close();
  }

  wait() {
    this.render(true);
    return new Promise(resolve => {
      this._resolve = resolve;
    });
  }

  async close(options = {}) {
    if (this._resolve) {
      this._resolve(null);
    }
    return super.close(options);
  }
}

// Indulge Vice Dialog
class IndulgeViceDialog extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
  constructor(data = {}, options = {}) {
    super(options);
    this.data = data;
    this._resolve = null;
  }

  static DEFAULT_OPTIONS = {
    id: "indulge-vice-dialog",
    window: {
      title: "BITD.DowntimePlanner.IndulgeVice.Title",
      icon: "fas fa-cocktail"
    },
    position: {
      width: 800,
      height: "auto"
    },
    classes: ["indulge-vice-dialog"],
    actions: {
      confirm: IndulgeViceDialog.onConfirm,
      cancel: IndulgeViceDialog.onCancel
    }
  };

  static PARTS = {
    form: {
      template: "modules/downtimeplanner-bitd/templates/indulge-vice.hbs"
    }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    
    // Get character data for auto-fill
    const character = game.user.character;
    console.log("=== Indulge Vice Auto-fill Debug ===");
    console.log("Character:", character);
    console.log("Character System:", character?.system);
    
    if (character && !this.data.currentStress) {
      // Auto-fill stress if not already set
      const stressValue = character.system?.stress?.value || "0";
      console.log("Stress object:", character.system?.stress);
      console.log("Auto-filled stress:", stressValue);
      this.data.currentStress = stressValue;
      
      // Auto-fill trauma
      const traumaValue = character.system?.trauma?.value || "0";
      console.log("Trauma object:", character.system?.trauma);
      console.log("Auto-filled trauma:", traumaValue);
      this.data.trauma = traumaValue;
      
      // Find lowest attribute if not already set
      if (!this.data.lowestAttribute) {
        const attributes = character.system?.attributes;
        console.log("Attributes object:", attributes);
        
        if (attributes) {
          // Calculate Insight rating: count of actions with dots
          const insightSkills = attributes.insight?.skills;
          const insight = insightSkills ? 
            ['hunt', 'study', 'survey', 'tinker'].filter(skill => 
              parseInt(insightSkills[skill]?.value || 0) > 0
            ).length : 0;
          
          // Calculate Prowess rating: count of actions with dots
          const prowessSkills = attributes.prowess?.skills;
          const prowess = prowessSkills ? 
            ['finesse', 'prowl', 'skirmish', 'wreck'].filter(skill => 
              parseInt(prowessSkills[skill]?.value || 0) > 0
            ).length : 0;
          
          // Calculate Resolve rating: count of actions with dots
          const resolveSkills = attributes.resolve?.skills;
          const resolve = resolveSkills ? 
            ['attune', 'command', 'consort', 'sway'].filter(skill => 
              parseInt(resolveSkills[skill]?.value || 0) > 0
            ).length : 0;
          
          console.log("Insight rating (skills with dots):", insight);
          console.log("Prowess rating (skills with dots):", prowess);
          console.log("Resolve rating (skills with dots):", resolve);
          
          const min = Math.min(insight, prowess, resolve);
          console.log("Minimum value:", min);
          
          if (min === insight) this.data.lowestAttribute = "Insight";
          else if (min === prowess) this.data.lowestAttribute = "Prowess";
          else this.data.lowestAttribute = "Resolve";
          
          console.log("Selected lowest attribute:", this.data.lowestAttribute);
        }
      }
    }
    console.log("Final data:", this.data);
    console.log("====================================");
    
    context.data = this.data;
    
    // Enrich description HTML
    context.description = await TextEditor.enrichHTML(
      game.i18n.localize("BITD.DowntimePlanner.IndulgeVice.Description"),
      { async: true }
    );
    
    return context;
  }

  static async onConfirm(event, target) {
    const form = this.element.querySelector("form");
    const formData = new FormData(form);
    const vicePurveyor = formData.get("vicePurveyor")?.trim();
    const indulgenceDescription = formData.get("indulgenceDescription")?.trim();
    const lowestAttribute = formData.get("lowestAttribute");
    const currentStress = formData.get("currentStress");
    
    // Validate required fields
    if (!vicePurveyor) {
      ui.notifications.warn(game.i18n.localize("BITD.DowntimePlanner.IndulgeVice.PurveyorRequired"));
      return;
    }
    
    if (!indulgenceDescription) {
      ui.notifications.warn(game.i18n.localize("BITD.DowntimePlanner.IndulgeVice.DescriptionRequired"));
      return;
    }
    
    if (!lowestAttribute) {
      ui.notifications.warn(game.i18n.localize("BITD.DowntimePlanner.IndulgeVice.AttributeRequired"));
      return;
    }
    
    if (!currentStress || currentStress === "") {
      ui.notifications.warn(game.i18n.localize("BITD.DowntimePlanner.IndulgeVice.StressRequired"));
      return;
    }
    
    const data = {
      vicePurveyor: vicePurveyor,
      indulgenceDescription: indulgenceDescription,
      lowestAttribute: lowestAttribute,
      currentStress: parseInt(currentStress)
    };
    
    if (this._resolve) {
      this._resolve(data);
    }
    this.close();
  }

  static async onCancel(event, target) {
    if (this._resolve) {
      this._resolve(null);
    }
    this.close();
  }

  wait() {
    this.render(true);
    return new Promise(resolve => {
      this._resolve = resolve;
    });
  }

  async close(options = {}) {
    if (this._resolve) {
      this._resolve(null);
    }
    return super.close(options);
  }
}

// Helper function to get rule content
function getRuleContent(rule) {
  const rules = {
    overindulge: `<strong>Overindulge</strong><br><br>
      If you clear more stress than you had, select a consequence:<br><br>
      • <strong>Attract Trouble:</strong> Roll an additional entanglement<br>
      • <strong>Brag:</strong> +2 heat to crew<br>
      • <strong>Lost:</strong> Vanish for weeks, all harm healed<br>
      • <strong>Tapped:</strong> Find new vice purveyor`
  };
  return rules[rule] || "No information available.";
}

// Module Initialization
Hooks.once('init', () => {
  console.log("Downtime Planner | Initializing");
});

Hooks.once('ready', () => {
  console.log("Downtime Planner | Ready");
  
  // Register macro
  game.downtimePlanner = {
    open: () => {
      new DowntimePlannerApp().render(true);
    }
  };
});

// Handle clicks on rules links in chat messages
Hooks.on('renderChatMessage', (message, html) => {
  html.find('.rules-link').click(async (event) => {
    event.preventDefault();
    const rule = $(event.currentTarget).data('rule');
    
    const content = getRuleContent(rule);
    
    await foundry.applications.api.DialogV2.prompt({
      window: { title: "Rule Reference" },
      content: `<div class="rule-content" style="background-color: #1a1a1a; color: var(--color-text-light-primary); padding: 15px; border-radius: 5px;">${content}</div>`,
      ok: { label: "Close" },
      rejectClose: false,
      modal: true
    });
  });
});

// Add button to Actor Sheets
Hooks.on('renderActorSheet', (app, html, data) => {
  // Only add to character sheets
  if (app.actor.type !== 'character') return;
  
  const button = $(`<a class="downtime-planner-button" title="Downtime Planner">
    <i class="fas fa-clock"></i> Downtime
  </a>`);
  
  button.on('click', () => {
    new DowntimePlannerApp().render(true);
  });
  
  // Add to header buttons
  const headerButtons = html.find('.window-header .window-title');
  if (headerButtons.length) {
    headerButtons.after(button);
  }
});